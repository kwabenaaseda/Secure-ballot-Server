import { Service_Error_Handler, Service_Success_Handler } from "../../../types/Response_handler";
import { OPS_Success, OPS_Error } from "../../../lib/ops/ops.factory";
import { Log } from "../../../utils/Logger";
import { CreateElectionPayload } from "./types";
import { AppDataSource } from "../../../config/database";
import { Election } from "../../../entities/Election";
import { OrgMembers } from "../../../entities/OrgMembers";

const EVENT  = "ELECTION_CREATE";
const SOURCE = "CreateElection_Operation";

export async function CreateElection_Operation(
  payload: CreateElectionPayload
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
    org_id:     payload.org_id,
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // ── STEP 1: VALIDATE REQUIRED FIELDS ──────────────────────────────────────
    const { org_id, name, start_at, end_at, categories, creator_id } = payload;

    if (!org_id || !name || !start_at || !end_at || !categories?.length) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status:         "OPERATION_FAILURE",
        message:        "All required fields must be provided.",
        error_code:     "MISSING_REQUIRED_FIELDS",
        error_category: "VALIDATION",
        retryable:      true,
      });
    }

    if (new Date(start_at) >= new Date(end_at)) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status:         "OPERATION_FAILURE",
        message:        "start_at must be before end_at.",
        error_code:     "INVALID_ELECTION_WINDOW",
        error_category: "VALIDATION",
        retryable:      true,
      });
    }

    // ── STEP 2: AUTHORIZATION — creator must be active admin/moderator of org ──
    // This is the actual gate that makes "only orgs create elections" real.
    const memberRepo = queryRunner.manager.getRepository(OrgMembers);
    const membership = await memberRepo.findOne({
      where: { org: { id: org_id }, user: { id: creator_id } },
      relations: ["org", "user"],
    });

    if (!membership || membership.status !== "active" ||
        !["admin", "moderator"].includes(membership.role)) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status:         "OPERATION_FAILURE",
        message:        "Only active org admins or moderators can create elections.",
        error_code:     "NOT_AUTHORIZED",
        error_category: "AUTH",
        retryable:      false,
      });
    }

    // ── STEP 3: CREATE ELECTION ────────────────────────────────────────────────
    const electionPayload = {
      org:                    { id: org_id },
      name,
      summary:                payload.summary ?? null,
      field:                  payload.field ?? null,
      location:               payload.location ?? null,
      visibility:             payload.visibility,
      is_public:              payload.is_public,
      categories,
      status:                 "draft",
      start_at:               new Date(start_at),
      end_at:                 new Date(end_at),
      registration_cutoff_at: payload.registration_cutoff_at
        ? new Date(payload.registration_cutoff_at) : null,
    } as any;

    const newElection = queryRunner.manager.create(Election, electionPayload);

    const saved = await queryRunner.manager.save(newElection);
    await queryRunner.commitTransaction();

    Log.info(SOURCE, "Election created successfully", EVENT);

    return await OPS_Success({
      ...ops_base,
      election_id: saved.id,
      status:  "COMPLETED",
      message: "Election created successfully.",
      data: {
        election: {
          id: saved.id, name: saved.name, status: saved.status,
          start_at: saved.start_at, end_at: saved.end_at,
        },
      },
    });

  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), EVENT);

    return await OPS_Error({
      ...ops_base,
      status:         "SYSTEM_FAILURE",
      message:        `An unexpected error occurred during ${EVENT}. `,
      error_code:     "INTERNAL_ERROR",
      error_category: "SYSTEM",
      retryable:      true,
      retry_after_ms: 5000,
      stack_ref:      `${EVENT}_${started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}