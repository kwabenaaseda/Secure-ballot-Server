// src/services/organization_management/approve_join/index.ts
// Org-admin join-request review: list pending requests and approve/deny them.
// A pending membership becomes ACTIVE on approval (with joined_at stamped) or
// DEACTIVATED on denial — the same row is never deleted.

import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { OrgMembers } from '../../../entities/OrgMembers';
import { OrgMemberProfiles } from '../../../entities/OrgMember_profile';
import { NetworkContext } from '../../../lib/ops/ops.types';
import Operations_Manager, { Authorize } from '../../../utils/ops.manager';

const SOURCE = 'ApproveJoin_Operation';

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

// ─── LIST PENDING JOIN REQUESTS ───────────────────────────────────────────────
export async function ListPendingJoinRequests_Operation(payload: {
  orgId: string;
  actorId: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ORG_LIST_PENDING_JOINS', payload.actorId, payload.network, payload.orgId);
  const started_at = Date.now();

  try {
    // Coarse tier gate — the row-level admin/moderator check follows below.
    const ops = await Operations_Manager({
      user_id: payload.actorId,
      org_id: payload.orgId,
      location: 'organization',
    });
    if (ops === false || !Authorize(ops.role, 'org_membership', 'verify_join_request')) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Not authorized to review join requests.',
        error_code: 'FORBIDDEN',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const memberRepo = AppDataSource.getRepository(OrgMembers);
    const actor = await memberRepo.findOne({
      where: { org: { id: payload.orgId }, user: { id: payload.actorId } },
    });
    if (!actor || actor.status !== 'active' || !['admin', 'moderator'].includes(actor.role)) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Only active org admins or moderators can review join requests.',
        error_code: 'NOT_AUTHORIZED',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const [pending, profiles] = await Promise.all([
      memberRepo.find({
        where: { org: { id: payload.orgId }, status: 'pending' },
        relations: ['user'],
        order: { id: 'ASC' },
      }),
      AppDataSource.getRepository(OrgMemberProfiles).find({
        where: { org: { id: payload.orgId } },
        relations: ['user'],
      }),
    ]);

    const profileByUserId = new Map(
      profiles.map((p) => [p.user.id, { custom_data: p.custom_data, submitted_at: p.submitted_at }])
    );

    const requests = pending.map((m) => ({
      id: m.id,
      user_id: m.user.id,
      userName: m.user.username,
      userEmail: m.user.email,
      status: m.status,
      submitted_at: profileByUserId.get(m.user.id)?.submitted_at ?? m.joined_at,
      custom_fields: profileByUserId.get(m.user.id)?.custom_data ?? {},
    }));

    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: 'Pending join requests retrieved.',
      data: { requests, count: requests.length },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'ORG_LIST_PENDING_JOINS');
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to retrieve join requests.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ORG_LIST_PENDING_JOINS_${ops_base.started_at}`,
    });
  }
}
// ─── DECIDE JOIN REQUEST (approve / deny) ─────────────────────────────────────
export async function DecideJoinRequest_Operation(payload: {
  orgId: string;
  memberId: string;
  actorId: string;
  decision: 'approve' | 'deny';
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const event = payload.decision === 'approve' ? 'ORG_APPROVE_JOIN' : 'ORG_DENY_JOIN';
  const ops_base = base(event, payload.actorId, payload.network, payload.orgId);
  const started_at = Date.now();
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Coarse tier gate — the row-level admin/moderator check follows below.
    const ops = await Operations_Manager({
      user_id: payload.actorId,
      org_id: payload.orgId,
      location: 'organization',
    });
    if (ops === false || !Authorize(ops.role, 'org_membership', 'verify_join_request')) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Not authorized to review join requests.',
        error_code: 'FORBIDDEN',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const actor = await memberRepo.findOne({
      where: { org: { id: payload.orgId }, user: { id: payload.actorId } },
    });
    if (!actor || actor.status !== 'active' || !['admin', 'moderator'].includes(actor.role)) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Only active org admins or moderators can review join requests.',
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
        message: 'Join request not found in this organization.',
        error_code: 'MEMBER_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    if (target.status !== 'pending') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: `This request was already ${target.status}.`,
        error_code: 'INVALID_MEMBER_STATE',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    if (payload.decision === 'approve') {
      target.status = 'active';
      target.joined_at = new Date();
    } else {
      target.status = 'deactivated';
    }
    await queryRunner.manager.save(target);
    await queryRunner.commitTransaction();

    // Fire in-app notification (best-effort, never fails the decision).
    const { CreateNotification } = await import('../../notifications');
    await CreateNotification({
      user_id: target.user.id,
      type: payload.decision === 'approve' ? 'JOIN_APPROVED' : 'JOIN_DENIED',
      title:
        payload.decision === 'approve'
          ? `Welcome to ${target.org.name}`
          : `Join request declined`,
      body:
        payload.decision === 'approve'
          ? `Your request to join ${target.org.name} was approved. You can now participate in its elections.`
          : `Your request to join ${target.org.name} was not approved this time.`,
      link: payload.decision === 'approve' ? '/organizations' : '/organizations',
    });

    Log.info(SOURCE, `Join request ${target.id} ${payload.decision}d`, event);
    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: payload.decision === 'approve' ? 'Join request approved.' : 'Join request denied.',
      data: { member_id: target.id, status: target.status },
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), event);
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to process join request.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${event}_${ops_base.started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}
