// src/services/organization/join/index.ts
import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { OrganizationAuth } from '../../../entities/Org_auth';
import { OrgMembers } from '../../../entities/OrgMembers';
import { OrgMemberProfiles } from '../../../entities/OrgMember_profile';
import { NetworkContext } from '../../../lib/ops/ops.types';

const EVENT = 'ORG_JOIN';
const SOURCE = 'JoinOrganization_Operation';

export async function JoinOrganization_Operation(payload: {
  orgId: string;
  userId: string;
  submitted_data?: Record<string, any>;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'VOTER' as const,
    actor_id: payload.userId,
    started_at,
    network: payload.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const existing = await queryRunner.manager.getRepository(OrgMembers).findOne({
      where: { org: { id: payload.orgId }, user: { id: payload.userId } },
    });
    if (existing) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: `Already ${existing.status} on this organization.`,
        error_code: 'ALREADY_MEMBER',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    const auth = await queryRunner.manager
      .getRepository(OrganizationAuth)
      .findOne({ where: { org: { id: payload.orgId } } });
    const customFields = (auth?.custom_fields as any[]) ?? [];
    const isOpenMode = customFields.length === 0;

    // Open mode: piggyback on existing account verification, active immediately.
    // Custom mode: pending until an org admin reviews (verify_join_request).
    const membership = queryRunner.manager.create(OrgMembers, {
      org: { id: payload.orgId } as any,
      user: { id: payload.userId } as any,
      role: 'voter',
      status: isOpenMode ? 'active' : 'pending',
      verified_via: isOpenMode ? 'email_verified' : 'custom',
      joined_at: isOpenMode ? new Date() : null,
    });
    await queryRunner.manager.save(membership);

    if (!isOpenMode) {
      // Validate required fields were actually submitted before accepting.
      const missing = customFields.filter(
        (f) => f.required && !(payload.submitted_data ?? {})[f.key]
      );
      if (missing.length > 0) {
        await queryRunner.rollbackTransaction();
        return await OPS_Error({
          ...ops_base,
          status: 'OPERATION_FAILURE',
          message: `Missing required fields: ${missing.map((f) => f.label).join(', ')}`,
          error_code: 'MISSING_CUSTOM_FIELDS',
          error_category: 'VALIDATION',
          retryable: true,
        });
      }
      const profileRepo = queryRunner.manager.getRepository(OrgMemberProfiles);
      await profileRepo.save(
        profileRepo.create({
          org: { id: payload.orgId } as any,
          user: { id: payload.userId } as any,
          custom_data: payload.submitted_data ?? {},
          version: auth?.schema_version ?? 1,
          submitted_at: new Date(),
        })
      );
    }

    await queryRunner.commitTransaction();
    Log.info(
      SOURCE,
      isOpenMode ? 'Joined organization (open mode)' : 'Join request submitted, pending review',
      EVENT
    );

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: isOpenMode
        ? 'Joined organization.'
        : 'Join request submitted. An administrator will review it.',
      data: { status: membership.status },
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: `An unexpected error occurred during ${EVENT}. `,
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}
