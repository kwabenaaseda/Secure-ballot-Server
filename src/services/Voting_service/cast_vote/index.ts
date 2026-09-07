import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { CastVotePayload } from './types';
import { AppDataSource } from '../../../config/database';
import { Election } from '../../../entities/Election';
import { Candidate } from '../../../entities/Candidates';
import { OrgMembers } from '../../../entities/OrgMembers';
import { VoteRecord } from '../../../entities/Vote_record';
import { VoteTally } from '../../../entities/Vote_tally';
import { BiometricCredential } from '../../../entities/BiometricCredential';
import { verifyStepUpToken } from '../../biometric/verifyStepUp';

const EVENT = 'VOTE_SUBMIT';
const SOURCE = 'CastVote_Operation';

export async function CastVote_Operation(
  payload: CastVotePayload,
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();

  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'VOTER' as const,
    actor_id: payload.voter_id,
    started_at,
    network: payload.network,
    auth: payload.auth,
    classification: 'SEALED' as const,
    integrity_class: 'IMMUTABLE' as const,
    election_id: payload.election_id,
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { election_id, selections, voter_id } = payload;

    if (!election_id || !voter_id || !selections?.length) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'election_id, voter_id, and at least one selection are required.',
        error_code: 'MISSING_REQUIRED_FIELDS',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    // --- STEP 1: ELECTION MUST BE OPEN RIGHT NOW --------------------------------
    const electionRepo = queryRunner.manager.getRepository(Election);
    const election = await electionRepo.findOne({
      where: { id: election_id },
      relations: ['org'],
    });

    if (!election || election.status !== 'published') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Election is not open for voting.',
        error_code: 'ELECTION_NOT_OPEN',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    // --- STEP 1.5: ORG MUST STILL BE ACTIVE ------------------------------------
    // A suspension after an election was already published must not leave a live,
    // votable election behind. This is what makes "admin can stop them from
    // causing problems" true at the moment it matters most.
    if (election.org.status !== 'active') {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: "This election's organization is not active. Voting is disabled.",
        error_code: 'ORG_NOT_ACTIVE',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const now = new Date();
    if (now < election.start_at || now > election.end_at) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Voting window is not currently active.',
        error_code: 'OUTSIDE_VOTING_WINDOW',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    // --- STEP 2.5: STEP-UP (biometric) GATE -----------------------------------
    // If the voter has enrolled biometric credentials, a valid step-up token is
    // required to prove presence at the moment of voting.
    const credRepo = queryRunner.manager.getRepository(BiometricCredential);
    const enrolledCount = await credRepo.count({ where: { user_id: voter_id } });
    if (enrolledCount > 0) {
      if (!payload.step_up_token) {
        await queryRunner.rollbackTransaction();
        return await OPS_Error({
          ...ops_base,
          status: 'OPERATION_FAILURE',
          message: 'Biometric verification required. Please authenticate to vote.',
          error_code: 'STEP_UP_REQUIRED',
          error_category: 'AUTH',
          retryable: true,
        });
      }
      const stepUp = verifyStepUpToken(payload.step_up_token, 'VOTE', payload.election_id);
      if (!stepUp.ok) {
        await queryRunner.rollbackTransaction();
        return await OPS_Error({
          ...ops_base,
          status: 'OPERATION_FAILURE',
          message: stepUp.reason,
          error_code: 'STEP_UP_INVALID',
          error_category: 'AUTH',
          retryable: true,
        });
      }
    }

    // --- STEP 3: MEMBERSHIP GATE -------------------------------------------------
    // Voter must be an active member of the election's organization.
    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const membership = await memberRepo.findOne({
      where: { org: { id: election.org.id }, user: { id: voter_id }, status: 'active' },
    });
    if (!membership) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'You are not an active member of this organization.',
        error_code: 'NOT_A_MEMBER',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    // --- STEP 4: EVERY SELECTED CANDIDATE MUST BELONG TO THIS ELECTION ----------
    // and match the category the voter declared. Fetching all of the election's
    // candidates once validates the whole ballot server-side (handles both
    // single- and multi-category ballots) and blocks a voter from pairing a
    // candidate with the wrong category.
    const candidateRepo = queryRunner.manager.getRepository(Candidate);
    const candidates = await candidateRepo.find({
      where: { election: { id: election_id } },
    });

    const chosen: Candidate[] = [];
    for (const sel of selections) {
      const cand = candidates.find((c) => c.id === sel.candidate_id);
      if (!cand || cand.category !== sel.category) {
        await queryRunner.rollbackTransaction();
        return await OPS_Error({
          ...ops_base,
          status: 'OPERATION_FAILURE',
          message: `Candidate "${sel.candidate_id}" is not valid for category "${sel.category}".`,
          error_code: 'INVALID_CANDIDATE',
          error_category: 'VALIDATION',
          retryable: false,
        });
      }
      chosen.push(cand);
    }

    // --- STEP 5: RECORD PARTICIPATION --------------------------------------------
    // One VoteRecord per (user, election). The @Unique(['user','election'])
    // constraint turns any second ballot into a 23505 -> ALREADY_VOTED below,
    // so the entire multi-category selection is treated as a single,
    // non-replaceable participation event.
    const voteRecordRepo = queryRunner.manager.getRepository(VoteRecord);
    const record = voteRecordRepo.create({
      user: { id: voter_id } as any,
      election: { id: election_id } as any,
    });
    await queryRunner.manager.save(record);

    // --- STEP 6: INCREMENT EACH SELECTED CANDIDATE'S TALLY -----------------------
    // Tally rows are pre-seeded at 0 by AddCandidate, so a plain atomic UPDATE
    // is safe and race-free for any number of selections (single- or
    // multi-category ballots).
    for (const cand of chosen) {
      await queryRunner.manager
        .createQueryBuilder()
        .update(VoteTally)
        .set({ vote_count: () => 'vote_count + 1' })
        .where('candidate_id = :candidate_id AND election_id = :election_id', {
          candidate_id: cand.id,
          election_id,
        })
        .execute();
    }

    await queryRunner.commitTransaction();

    Log.info(SOURCE, 'Vote recorded', EVENT);

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Vote recorded successfully.',
      data: { election_id, voted_at: record.voted_at },
    });
  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), EVENT);

    if (error?.code === '23505') {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'You have already voted in this election.',
        error_code: 'ALREADY_VOTED',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

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
