// src/services/Election_management/close_election/index.ts
// POST /election/:electionId/close — published -> closed (manual close).
// Only active org admins/moderators. An election also auto-closes at end_at
// via effectiveElectionStatus, but admins may close early (e.g. results known).

import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { Election } from '../../../entities/Election';
import { OrgMembers } from '../../../entities/OrgMembers';
import { NetworkContext } from '../../../lib/ops/ops.types';

const SOURCE = 'CloseElection_Operation';
const EVENT = 'ELECTION_CLOSE';

export async function CloseElection_Operation(payload: {
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

    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const membership = await memberRepo.findOne({
      where: { org: { id: election.org.id }, user: { id: payload.actorId } },
    });
    if (!membership || membership.status !== 'active' || !['admin', 'moderator'].includes(membership.role)) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Only active org admins or moderators can close elections.',
        error_code: 'NOT_AUTHORIZED',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    if (election.status === 'draft') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Draft elections must be published before they can be closed.',
        error_code: 'INVALID_ELECTION_STATE',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    if (election.status === 'closed') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Election is already closed.',
        error_code: 'INVALID_ELECTION_STATE',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    election.status = 'closed';
    await queryRunner.manager.save(election);
    await queryRunner.commitTransaction();

    Log.info(SOURCE, `Election ${election.id} closed`, EVENT);
    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Election closed.',
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