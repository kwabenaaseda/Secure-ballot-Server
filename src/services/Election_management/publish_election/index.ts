// src/services/Election_management/publish_election/index.ts
// POST /election/:electionId/publish — draft -> published.
// Only active org admins/moderators. The org must be active and the election
// must have at least one candidate and a future end date.

import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { Election } from '../../../entities/Election';
import { Candidate } from '../../../entities/Candidates';
import { OrgMembers } from '../../../entities/OrgMembers';
import { NetworkContext } from '../../../lib/ops/ops.types';

const SOURCE = 'PublishElection_Operation';
const EVENT = 'ELECTION_PUBLISH';

export async function PublishElection_Operation(payload: {
  electionId: string;
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
    election_id: payload.electionId,
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const electionRepo = queryRunner.manager.getRepository(Election);
    const election = await electionRepo.findOne({
      where: { id: payload.electionId },
      relations: ['org'],
    });
    if (!election) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Election not found.',
        error_code: 'ELECTION_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    // Authorization: active admin/moderator of the election's org
    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const membership = await memberRepo.findOne({
      where: { org: { id: election.org.id }, user: { id: payload.actorId } },
    });
    if (!membership || membership.status !== 'active' || !['admin', 'moderator'].includes(membership.role)) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Only active org admins or moderators can publish elections.',
        error_code: 'NOT_AUTHORIZED',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    // Org must be active (suspended orgs cannot launch elections).
    if (election.org.status !== 'active') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'This organization is not active. Elections cannot be published.',
        error_code: 'ORG_NOT_ACTIVE',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    if (election.status !== 'draft') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: `Only draft elections can be published (current status: ${election.status}).`,
        error_code: 'INVALID_ELECTION_STATE',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    if (new Date() > new Date(election.end_at)) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'The voting window has already elapsed.',
        error_code: 'INVALID_ELECTION_WINDOW',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    // Require at least one candidate before going live.
    const candidateCount = await queryRunner.manager.getRepository(Candidate).count({
      where: { election: { id: election.id } },
    });
    if (candidateCount === 0) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Add at least one candidate before publishing.',
        error_code: 'NO_CANDIDATES',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    // Publication is the vetting gate: heal any legacy 'pending' candidates so
    // every candidate on a published ballot is visible to voters.
    await queryRunner.manager
      .createQueryBuilder()
      .update(Candidate)
      .set({ vetting_status: 'approved' })
      .where('election_id = :election_id AND vetting_status = :status', {
        election_id: election.id,
        status: 'pending',
      })
      .execute();

    election.status = 'published';
    await queryRunner.manager.save(election);
    await queryRunner.commitTransaction();

    Log.info(SOURCE, `Election ${election.id} published`, EVENT);
    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Election published.',
      data: { election_id: election.id, status: election.status },
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