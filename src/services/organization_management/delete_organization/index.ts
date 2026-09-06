// src/services/organization_management/delete_organization/index.ts
// DELETE /org/:orgId — hard-delete an organization and all dependent data in a
// single transaction. Restricted to the org's own ACTIVE admin.
//
// No ON DELETE CASCADE exists from dependent tables up to organizations, so we
// remove every dependent row explicitly, child-first:
//   elections -> candidates, vote_tallies, vote_records
//   org_members, org_member_profiles, organization_auth

import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { Organization } from '../../../entities/Organization';
import { OrgMembers } from '../../../entities/OrgMembers';
import { OrgMemberProfiles } from '../../../entities/OrgMember_profile';
import { OrganizationAuth } from '../../../entities/Org_auth';
import { Election } from '../../../entities/Election';
import { Candidate } from '../../../entities/Candidates';
import { VoteTally } from '../../../entities/Vote_tally';
import { VoteRecord } from '../../../entities/Vote_record';
import { NetworkContext } from '../../../lib/ops/ops.types';

const SOURCE = 'DeleteOrganization_Operation';
const EVENT = 'DELETE_ORGANIZATION';

export async function DeleteOrganization_Operation(payload: {
  orgId: string;
  actorId: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'ORG_ADMIN' as const,
    actor_id: payload.actorId,
    started_at,
    network: payload.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
    org_id: payload.orgId,
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const orgRepo = queryRunner.manager.getRepository(Organization);
    const org = await orgRepo.findOneBy({ id: payload.orgId });
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

    // AUTHORIZATION: only an ACTIVE admin of this org may delete it.
    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const actor = await memberRepo.findOne({
      where: { org: { id: org.id }, user: { id: payload.actorId } },
    });
    if (!actor || actor.status !== 'active' || actor.role !== 'admin') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Only an active organization admin can delete this organization.',
        error_code: 'NOT_AUTHORIZED',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const electionRepo = queryRunner.manager.getRepository(Election);
    const candidateRepo = queryRunner.manager.getRepository(Candidate);
    const tallyRepo = queryRunner.manager.getRepository(VoteTally);
    const voteRecordRepo = queryRunner.manager.getRepository(VoteRecord);
    const profileRepo = queryRunner.manager.getRepository(OrgMemberProfiles);
    const authRepo = queryRunner.manager.getRepository(OrganizationAuth);

    // 1) Election-scoped rows (child-first). Safe when empty.
    const electionIds = await electionRepo
      .createQueryBuilder('e')
      .select('e.id')
      .where('e.org_id = :orgId', { orgId: org.id })
      .getMany()
      .then((rows) => rows.map((r) => r.id));

    if (electionIds.length > 0) {
      await tallyRepo
        .createQueryBuilder()
        .delete()
        .where('election_id IN (:...ids)', { ids: electionIds })
        .execute();
      await voteRecordRepo
        .createQueryBuilder()
        .delete()
        .where('election_id IN (:...ids)', { ids: electionIds })
        .execute();
      await candidateRepo
        .createQueryBuilder()
        .delete()
        .where('election_id IN (:...ids)', { ids: electionIds })
        .execute();
      await electionRepo
        .createQueryBuilder()
        .delete()
        .where('id IN (:...ids)', { ids: electionIds })
        .execute();
    }

    // 2) Member profiles (must precede org_members due to UNIQUE(org,user)).
    await profileRepo
      .createQueryBuilder()
      .delete()
      .where('org_id = :orgId', { orgId: org.id })
      .execute();

    // 3) Memberships.
    await memberRepo
      .createQueryBuilder()
      .delete()
      .where('org_id = :orgId', { orgId: org.id })
      .execute();

    // 4) Org auth schema.
    await authRepo
      .createQueryBuilder()
      .delete()
      .where('org_id = :orgId', { orgId: org.id })
      .execute();

    // 5) The org itself - last, so nothing references a missing row.
    await orgRepo
      .createQueryBuilder()
      .delete()
      .where('id = :orgId', { orgId: org.id })
      .execute();

    await queryRunner.commitTransaction();
    Log.info(SOURCE, `Organization ${org.id} deleted`, EVENT);

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Organization deleted permanently.',
      data: { org_id: org.id },
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to delete organization.',
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
