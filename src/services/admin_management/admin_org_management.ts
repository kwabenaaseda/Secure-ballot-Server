import { Service_Error_Handler, Service_Success_Handler } from '../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../lib/ops/ops.factory';
import { Log } from '../../utils/Logger';
import { AppDataSource } from '../../config/database';
import { Organization } from '../../entities/Organization';
import { OrgMembers } from '../../entities/OrgMembers';
import { NetworkContext } from '../../lib/ops/ops.types';

const SOURCE = 'AdminOrgManagement_Operation';

function base(event: string, admin_id: string, network: NetworkContext, org_id: string) {
  return {
    event,
    source: SOURCE,
    actor_type: 'SYSTEM_ADMIN' as const,
    actor_id: admin_id,
    started_at: Date.now(),
    network,
    auth: { factors_used: ['SESSION'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
    org_id,
  };
}

// ── APPROVE: org -> active, creator's admin membership -> active ───────────
// This is the two-row flip described in create_organization/index.ts —
// nothing else in the codebase needs to change for the org to start working.
export async function ApproveOrganization_Operation(payload: {
  admin_id: string;
  network: NetworkContext;
  org_id: string;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ADMIN_APPROVE_ORG', payload.admin_id, payload.network, payload.org_id);
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const orgRepo = queryRunner.manager.getRepository(Organization);
    const org = await orgRepo.findOne({
      where: { id: payload.org_id },
      relations: ['primary_admin'],
    });

    if (!org) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Organization not found.',
        error_code: 'ORG_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }
    if (org.status !== 'pending') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: `Organization is already ${org.status}, not pending.`,
        error_code: 'INVALID_ORG_STATE',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    org.status = 'active';
    org.reviewed_by = payload.admin_id;
    org.reviewed_at = new Date();
    org.rejection_reason = null;
    await queryRunner.manager.save(org);

    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const membership = await memberRepo.findOne({
      where: { org: { id: org.id }, user: { id: org.primary_admin.id } },
    });
    if (membership) {
      membership.status = 'active';
      await queryRunner.manager.save(membership);
    }

    await queryRunner.commitTransaction();
    Log.info(SOURCE, `Organization ${org.id} approved`, 'ADMIN_APPROVE_ORG');

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Organization approved.',
      data: { org_id: org.id, status: org.status },
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), 'ADMIN_APPROVE_ORG');
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to approve organization.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ADMIN_APPROVE_ORG_${ops_base.started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}

// ── REJECT: org -> rejected, requires a reason ──────────────────────────────
export async function RejectOrganization_Operation(payload: {
  admin_id: string;
  network: NetworkContext;
  org_id: string;
  reason: string;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ADMIN_REJECT_ORG', payload.admin_id, payload.network, payload.org_id);
  try {
    if (!payload.reason) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'A rejection reason is required.',
        error_code: 'MISSING_REQUIRED_FIELDS',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }
    const orgRepo = AppDataSource.getRepository(Organization);
    const org = await orgRepo.findOneBy({ id: payload.org_id });
    if (!org) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Organization not found.',
        error_code: 'ORG_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }
    org.status = 'rejected';
    org.reviewed_by = payload.admin_id;
    org.reviewed_at = new Date();
    org.rejection_reason = payload.reason;
    await orgRepo.save(org);

    Log.info(SOURCE, `Organization ${org.id} rejected`, 'ADMIN_REJECT_ORG');
    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Organization rejected.',
      data: { org_id: org.id, status: org.status },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'ADMIN_REJECT_ORG');
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to reject organization.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ADMIN_REJECT_ORG_${ops_base.started_at}`,
    });
  }
}

// ── SUSPEND: org -> suspended (post-approval "make sure they don't cause
// problems" action). Also deactivates ALL active memberships in that org —
// not just the creator's — so every admin/moderator/voter in a suspended
// org loses access, not just the one account we happen to know about. ────
export async function SuspendOrganization_Operation(payload: {
  admin_id: string;
  network: NetworkContext;
  org_id: string;
  reason?: string;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ADMIN_SUSPEND_ORG', payload.admin_id, payload.network, payload.org_id);
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const orgRepo = queryRunner.manager.getRepository(Organization);
    const org = await orgRepo.findOneBy({ id: payload.org_id });
    if (!org) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Organization not found.',
        error_code: 'ORG_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    org.status = 'suspended';
    org.reviewed_by = payload.admin_id;
    org.reviewed_at = new Date();
    org.rejection_reason = payload.reason ?? null;
    await queryRunner.manager.save(org);

    await queryRunner.manager
      .createQueryBuilder()
      .update(OrgMembers)
      .set({ status: 'deactivated' })
      .where('org_id = :org_id AND status = :active', { org_id: org.id, active: 'active' })
      .execute();

    await queryRunner.commitTransaction();
    Log.info(SOURCE, `Organization ${org.id} suspended`, 'ADMIN_SUSPEND_ORG');

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Organization suspended. All member access revoked.',
      data: { org_id: org.id, status: org.status },
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), 'ADMIN_SUSPEND_ORG');
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to suspend organization.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ADMIN_SUSPEND_ORG_${ops_base.started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}
