// src/services/Election_management/release_results/index.ts
// POST /election/:electionId/release-results — the RESULT PUBLICATION flow.
// Only admins/moderators. Requires the election to be effectively closed
// (either manually closed or end_at passed). Stamps results_released_at/by.

import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { Election } from '../../../entities/Election';
import { OrgMembers } from '../../../entities/OrgMembers';
import { NetworkContext } from '../../../lib/ops/ops.types';
import { effectiveElectionStatus, finalizeElectionIfExpired } from '../helpers/election.status';

const SOURCE = 'ReleaseResults_Operation';
const EVENT = 'ELECTION_RESULTS_RELEASE';

export async function ReleaseResults_Operation(payload: {
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
    await finalizeElectionIfExpired(electionRepo, election);

    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const membership = await memberRepo.findOne({
      where: { org: { id: election.org.id }, user: { id: payload.actorId } },
    });
    if (!membership || membership.status !== 'active' || !['admin', 'moderator'].includes(membership.role)) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Only active org admins or moderators can release results.',
        error_code: 'NOT_AUTHORIZED',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const effective = effectiveElectionStatus(election);
    if (effective !== 'closed') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Results can only be released after the election closes.',
        error_code: 'ELECTION_NOT_CLOSED',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    if (election.results_status === 'released') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Results were already released.',
        error_code: 'RESULTS_ALREADY_RELEASED',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    election.results_status = 'released';
    election.results_released_at = new Date();
    election.results_released_by = payload.actorId;
    await queryRunner.manager.save(election);
    await queryRunner.commitTransaction();

    Log.info(SOURCE, `Results for election ${election.id} released`, EVENT);
    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Results released.',
      data: {
        election_id: election.id,
        results_status: election.results_status,
        results_released_at: election.results_released_at,
      },
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