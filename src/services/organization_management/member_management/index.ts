// src/services/organization_management/member_management/index.ts
// Org-admin member management: list members, update roles, update status.
// Every operation is gated on the caller being an ACTIVE member of the org
// with the required role (admin for mutations, admin/moderator for reads).

import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { OrgMembers } from '../../../entities/OrgMembers';
import { Organization } from '../../../entities/Organization';
import { OrgMemberProfiles } from '../../../entities/OrgMember_profile';
import { NetworkContext } from '../../../lib/ops/ops.types';
import Operations_Manager, { Authorize } from '../../../utils/ops.manager';

const SOURCE = 'MemberManagement_Operation';

function base(event: string, actorId: string, network: NetworkContext, orgId: string) {
  return {
    event,
    source: SOURCE,
    actor_type: 'ORG_ADMIN' as const,
    actor_id: actorId,
    started_at: Date.now(),
    network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
    org_id: orgId,
  };
}

// ─── AUTHORIZATION ────────────────────────────────────────────────────────────
// Returns the active membership if the actor may proceed with the given role,
// or null when the actor is not an active admin/moderator of this org.
async function authorize(
  repo: ReturnType<typeof AppDataSource.getRepository<OrgMembers>>,
  orgId: string,
  actorId: string,
  allowedRoles: string[]
) {
  const membership = await repo.findOne({
    where: { org: { id: orgId }, user: { id: actorId } },
  });
  if (!membership || membership.status !== 'active' || !allowedRoles.includes(membership.role)) {
    return null;
  }
  return membership;
}

async function notAuthorized(ops_base: ReturnType<typeof base>) {
  return await OPS_Error({
    ...ops_base,
    status: 'OPERATION_FAILURE',
    message: 'Only active org admins or moderators can manage members.',
    error_code: 'NOT_AUTHORIZED',
    error_category: 'AUTH',
    retryable: false,
  });
}

// ─── TIER-PERMISSION GATE ─────────────────────────────────────────────────────
// Coarse matrix layer. Both ORG_ACCESS[PART] and ORG_ACCESS[FULL] carry
// org_membership.verify_join_request; a `false` here means the caller's
// resolved role tier is not entitled to manage org membership at all.
// Row-level ownership checks still run after this in each operation.
async function hasOrgMemberTier(actorId: string, orgId: string): Promise<boolean> {
  const ops = await Operations_Manager({
    user_id: actorId,
    org_id: orgId,
    location: 'organization',
  });
  if (ops === false) return false;
  return Authorize(ops.role, 'org_membership', 'verify_join_request');
}

// ─── LIST MEMBERS ─────────────────────────────────────────────────────────────
export async function ListMembers_Operation(payload: {
  orgId: string;
  actorId: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ORG_LIST_MEMBERS', payload.actorId, payload.network, payload.orgId);
  const started_at = Date.now();

  try {
    if (!(await hasOrgMemberTier(payload.actorId, payload.orgId))) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Not authorized to manage org membership.',
        error_code: 'FORBIDDEN',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const memberRepo = AppDataSource.getRepository(OrgMembers);
    const membership = await authorize(memberRepo, payload.orgId, payload.actorId, ['admin', 'moderator']);
    if (!membership) return await notAuthorized({ ...ops_base, started_at });

    const [members, profiles] = await Promise.all([
      memberRepo.find({
        where: { org: { id: payload.orgId } },
        relations: ['user'],
        order: { joined_at: 'DESC' },
      }),
      AppDataSource.getRepository(OrgMemberProfiles).find({
        where: { org: { id: payload.orgId } },
        relations: ['user'],
      }),
    ]);

    const profilesByUserId = new Map(
      profiles.map((p) => [p.user.id, { custom_data: p.custom_data, submitted_at: p.submitted_at, version: p.version }])
    );

    const data = members.map((m) => ({
      id: m.id,
      user_id: m.user.id,
      name: m.user.username,
      email: m.user.email,
      role: m.role,
      status: m.status,
      verified_via: m.verified_via ?? null,
      joined_at: m.joined_at,
      custom_data: profilesByUserId.get(m.user.id)?.custom_data ?? null,
      submitted_at: profilesByUserId.get(m.user.id)?.submitted_at ?? null,
    }));

    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: 'Members retrieved.',
      data: { members: data, count: data.length },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'ORG_LIST_MEMBERS');
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to retrieve members.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ORG_LIST_MEMBERS_${ops_base.started_at}`,
    });
  }
}
// ─── UPDATE MEMBER ROLE ───────────────────────────────────────────────────────
// Only ADMIN can change roles (a moderator promoting someone to admin would
// be a privilege-escalation footgun).
export async function UpdateMemberRole_Operation(payload: {
  orgId: string;
  memberId: string;
  actorId: string;
  role: 'voter' | 'moderator' | 'admin';
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ORG_UPDATE_MEMBER_ROLE', payload.actorId, payload.network, payload.orgId);
  const started_at = Date.now();
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    if (!(await hasOrgMemberTier(payload.actorId, payload.orgId))) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Not authorized to manage org membership.',
        error_code: 'FORBIDDEN',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const actor = await authorize(memberRepo, payload.orgId, payload.actorId, ['admin']);
    if (!actor) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Only an active org admin can change member roles.',
        error_code: 'NOT_AUTHORIZED',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const target = await memberRepo.findOne({
      where: { id: payload.memberId, org: { id: payload.orgId } },
      relations: ['org', 'user'],
    });
    if (!target) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Member not found in this organization.',
        error_code: 'MEMBER_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    // Guard: cannot change your own role (prevents accidental self-demotion lockout).
    if (target.user.id === payload.actorId) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'You cannot change your own role.',
        error_code: 'SELF_MODIFICATION',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    // Guard: cannot demote the org's primary admin.
    const orgRepo = queryRunner.manager.getRepository(Organization);
    const org = await orgRepo.findOne({ where: { id: payload.orgId }, relations: ['primary_admin'] });
    if (org && org.primary_admin && org.primary_admin.id === target.user.id) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'The primary admin role cannot be changed.',
        error_code: 'PRIMARY_ADMIN_IMMUTABLE',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    target.role = payload.role;
    await queryRunner.manager.save(target);
    await queryRunner.commitTransaction();

    Log.info(SOURCE, `Member ${target.id} role -> ${payload.role}`, 'ORG_UPDATE_MEMBER_ROLE');
    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: 'Member role updated.',
      data: { member_id: target.id, role: target.role, status: target.status },
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), 'ORG_UPDATE_MEMBER_ROLE');
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to update member role.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ORG_UPDATE_MEMBER_ROLE_${ops_base.started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}
// ─── UPDATE MEMBER STATUS ─────────────────────────────────────────────────────
// ACTIVE <-> DEACTIVATED. Deactivating a member only revokes org access — it
// never deletes their vote history or profile.
export async function UpdateMemberStatus_Operation(payload: {
  orgId: string;
  memberId: string;
  actorId: string;
  status: 'active' | 'deactivated';
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ORG_UPDATE_MEMBER_STATUS', payload.actorId, payload.network, payload.orgId);
  const started_at = Date.now();
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    if (!(await hasOrgMemberTier(payload.actorId, payload.orgId))) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Not authorized to manage org membership.',
        error_code: 'FORBIDDEN',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const actor = await authorize(memberRepo, payload.orgId, payload.actorId, ['admin']);
    if (!actor) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Only an active org admin can change member status.',
        error_code: 'NOT_AUTHORIZED',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    if (payload.memberId === actor.id) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'You cannot change your own membership status.',
        error_code: 'SELF_MODIFICATION',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    const target = await memberRepo.findOne({
      where: { id: payload.memberId, org: { id: payload.orgId } },
      relations: ['org', 'user'],
    });
    if (!target) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Member not found in this organization.',
        error_code: 'MEMBER_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    // Guard: cannot deactivate the primary admin.
    const orgRepo = queryRunner.manager.getRepository(Organization);
    const org = await orgRepo.findOne({ where: { id: payload.orgId }, relations: ['primary_admin'] });
    if (org && org.primary_admin && org.primary_admin.id === target.user.id && payload.status === 'deactivated') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'The primary admin cannot be deactivated.',
        error_code: 'PRIMARY_ADMIN_IMMUTABLE',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    target.status = payload.status;
    if (payload.status === 'active' && !target.joined_at) {
      target.joined_at = new Date();
    }
    await queryRunner.manager.save(target);
    await queryRunner.commitTransaction();

    Log.info(SOURCE, `Member ${target.id} status -> ${payload.status}`, 'ORG_UPDATE_MEMBER_STATUS');
    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: payload.status === 'active' ? 'Member activated.' : 'Member deactivated.',
      data: { member_id: target.id, role: target.role, status: target.status },
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), 'ORG_UPDATE_MEMBER_STATUS');
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to update member status.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ORG_UPDATE_MEMBER_STATUS_${ops_base.started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}