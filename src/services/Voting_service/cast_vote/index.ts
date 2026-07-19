import { Service_Error_Handler, Service_Success_Handler } from "../../../types/Response_handler";
import { OPS_Success, OPS_Error } from "../../../lib/ops/ops.factory";
import { Log } from "../../../utils/Logger";
import { CastVotePayload } from "./types";
import { AppDataSource } from "../../../config/database";
import { Election } from "../../../entities/Election";
import { Candidate } from "../../../entities/Candidates";
import { OrgMembers } from "../../../entities/OrgMembers";
import { VoteRecord } from "../../../entities/Vote_record";
import { VoteTally } from "../../../entities/Vote_tally";

const EVENT  = "VOTE_SUBMIT";
const SOURCE = "CastVote_Operation";

export async function CastVote_Operation(
  payload: CastVotePayload
): Promise<Service_Success_Handler | Service_Error_Handler> {

  const started_at = Date.now();

  // ⚠️ classification: SEALED, integrity_class: IMMUTABLE — per your own
  // Response_handler.ts comment: "SEALED = shadow system, no log content,
  // only hash proof." This is the exact case it exists for.
  // ⚠️ data/message below deliberately never mention candidate_id — see
  // the entry_content trace we did on buildIntegrityProof: it's structurally
  // impossible for candidate info to enter the chain, but message text
  // is free-form, so discipline still matters there.
  const ops_base = {
    event:      EVENT,
    source:     SOURCE,
    actor_type: "VOTER" as const,
    actor_id:   payload.voter_id,
    started_at,
    network:    payload.network,
    auth:       payload.auth,
    classification:  "SEALED"    as const,
    integrity_class: "IMMUTABLE" as const,
    election_id: payload.election_id,
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { election_id, candidate_id, voter_id } = payload;

    if (!election_id || !candidate_id || !voter_id) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "election_id, candidate_id, and voter_id are required.",
        error_code: "MISSING_REQUIRED_FIELDS",
        error_category: "VALIDATION",
        retryable: true,
      });
    }

    // ── STEP 1: ELECTION MUST BE OPEN RIGHT NOW ───────────────────────────────
    const electionRepo = queryRunner.manager.getRepository(Election);
    const election = await electionRepo.findOne({
      where: { id: election_id }, relations: ["org"],
    });

    if (!election || election.status !== "published") {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "Election is not open for voting.",
        error_code: "ELECTION_NOT_OPEN",
        error_category: "VALIDATION",
        retryable: false,
      });
    }

    const now = new Date();
    if (now < election.start_at || now > election.end_at) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "Voting window is not currently active.",
        error_code: "OUTSIDE_VOTING_WINDOW",
        error_category: "VALIDATION",
        retryable: false,
      });
    }

    // ── STEP 2: VOTER MUST BE AN ACTIVE MEMBER OF THE ELECTION'S ORG ─────────
    // Skipped entirely for is_public elections — anyone can vote.
    if (!election.is_public) {
      const memberRepo = queryRunner.manager.getRepository(OrgMembers);
      const membership = await memberRepo.findOne({
        where: { org: { id: election.org.id }, user: { id: voter_id } },
      });

      if (!membership || membership.status !== "active") {
        await queryRunner.rollbackTransaction();
        return await OPS_Error({
          ...ops_base,
          status: "OPERATION_FAILURE",
          message: "You are not an active member of this organization.",
          error_code: "NOT_AUTHORIZED",
          error_category: "AUTH",
          retryable: false,
        });
      }
    }

    // ── STEP 3: CANDIDATE MUST BELONG TO THIS ELECTION ────────────────────────
    const candidateRepo = queryRunner.manager.getRepository(Candidate);
    const candidate = await candidateRepo.findOne({
      where: { id: candidate_id }, relations: ["election"],
    });

    if (!candidate || candidate.election.id !== election_id) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "Candidate does not belong to this election.",
        error_code: "INVALID_CANDIDATE",
        error_category: "VALIDATION",
        retryable: false,
      });
    }

    // ── STEP 4: RECORD PARTICIPATION ───────────────────────────────────────────
    // The DB's UNIQUE(user, election) constraint is the real enforcement of
    // "one vote per person" — this insert either succeeds once, or throws,
    // which the catch block below turns into a clean ALREADY_VOTED error.
    const voteRecordRepo = queryRunner.manager.getRepository(VoteRecord);
    const record = voteRecordRepo.create({
      user:     { id: voter_id }     as any,
      election: { id: election_id }  as any,
    });
    await queryRunner.manager.save(record);

    // ── STEP 5: INCREMENT TALLY — ATOMIC, NO READ-MODIFY-WRITE RACE ───────────
    // Raw increment via query builder, not save(), so concurrent votes for
    // the same candidate can't clobber each other (no fetch-then-write gap).
    await queryRunner.manager
      .createQueryBuilder()
      .update(VoteTally)
      .set({ vote_count: () => "vote_count + 1" })
      .where("candidate_id = :candidate_id AND election_id = :election_id", {
        candidate_id, election_id,
      })
      .execute();

    await queryRunner.commitTransaction();

    Log.info(SOURCE, "Vote recorded", EVENT);

    // Generic message and data — no candidate_id anywhere in this response
    // or in what gets audited. See ops_base comment above.
    return await OPS_Success({
      ...ops_base,
      status: "COMPLETED",
      message: "Vote recorded successfully.",
      data: { election_id, voted_at: record.voted_at },
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), EVENT);

    // Postgres unique_violation code — this is your "already voted" path
    if (error?.code === "23505") {
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "You have already voted in this election.",
        error_code: "ALREADY_VOTED",
        error_category: "VALIDATION",
        retryable: false,
      });
    }

    return await OPS_Error({
      ...ops_base,
      status: "SYSTEM_FAILURE",
      message: `An unexpected error occurred during ${EVENT}. `,
      error_code: "INTERNAL_ERROR",
      error_category: "SYSTEM",
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}