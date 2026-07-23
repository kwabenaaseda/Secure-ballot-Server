import { Service_Error_Handler, Service_Success_Handler } from "../../../types/Response_handler";
import { OPS_Success, OPS_Error } from "../../../lib/ops/ops.factory";
import { Log } from "../../../utils/Logger";
import { AddCandidatePayload } from "./types";
import { AppDataSource } from "../../../config/database";
import { Candidate } from "../../../entities/Candidates";
import { Election } from "../../../entities/Election";
import { OrgMembers } from "../../../entities/OrgMembers";
import { VoteTally } from "../../../entities/Vote_tally";

const EVENT  = "CANDIDATE_ADD";
const SOURCE = "AddCandidate_Operation";

export async function AddCandidate_Operation(
  payload: AddCandidatePayload
): Promise<Service_Success_Handler | Service_Error_Handler> {

  const started_at = Date.now();

  const ops_base = {
    event:      EVENT,
    source:     SOURCE,
    actor_type: "ORG_ADMIN" as const,
    actor_id:   payload.creator_id,
    started_at,
    network:    payload.network,
    auth:       payload.auth,
    classification:  "INTERNAL"  as const,
    integrity_class: "SENSITIVE" as const,
    election_id: payload.election_id,
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { election_id, fullname, category, creator_id } = payload;

    if (!election_id || !fullname || !category) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "election_id, fullname, and category are required.",
        error_code: "MISSING_REQUIRED_FIELDS",
        error_category: "VALIDATION",
        retryable: true,
      });
    }

    // ── Load election + confirm still editable ──────────────────────────────
    const electionRepo = queryRunner.manager.getRepository(Election);
    const election = await electionRepo.findOne({
      where: { id: election_id }, relations: ["org"],
    });

    if (!election) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "Election not found.",
        error_code: "ELECTION_NOT_FOUND",
        error_category: "VALIDATION",
        retryable: false,
      });
    }

    if (election.status !== "draft") {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "Candidates can only be added while the election is in draft.",
        error_code: "ELECTION_NOT_EDITABLE",
        error_category: "VALIDATION",
        retryable: false,
      });
    }

    // ── AUTHORIZATION — same gate as CreateElection ──────────────────────────
    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const membership = await memberRepo.findOne({
      where: { org: { id: election.org.id }, user: { id: creator_id } },
    });

    if (!membership || membership.status !== "active" ||
        !["admin", "moderator"].includes(membership.role)) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "Only active org admins or moderators can add candidates.",
        error_code: "NOT_AUTHORIZED",
        error_category: "AUTH",
        retryable: false,
      });
    }

    // ── CREATE CANDIDATE ──────────────────────────────────────────────────────
    const candidate = new Candidate();
    candidate.election = { id: election_id } as any;
    candidate.fullname = fullname;
    candidate.category = category;
    candidate.image = payload.image ?? null;
    candidate.summary = payload.summary ?? null;
    candidate.manifesto = payload.manifesto ?? null;
    candidate.nationality = payload.nationality ?? null;
    candidate.vetting_status = "pending";
    const savedCandidate = await queryRunner.manager.save(candidate);

    // ── INITIALIZE VOTE TALLY ROW AT ZERO ─────────────────────────────────────
    // Doing this now, not at first vote, means CastVote never has to check
    // "does a tally row exist yet" — it can always just UPDATE ... increment.
    // One less race condition to reason about at vote time, which is the
    // operation that matters most.
    const tally = queryRunner.manager.create(VoteTally, {
  candidate_id: savedCandidate.id,
  election_id:  election_id,
  vote_count:   0,
});
    await queryRunner.manager.save(tally);

    await queryRunner.commitTransaction();

    Log.info(SOURCE, "Candidate added successfully", EVENT);

    return await OPS_Success({
      ...ops_base,
      status: "COMPLETED",
      message: "Candidate added successfully.",
      data: {
        candidate: {
          id: savedCandidate.id, fullname: savedCandidate.fullname,
          category: savedCandidate.category,
        },
      },
    });

  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), EVENT);

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