import { Service_Error_Handler, Service_Success_Handler } from "../../../types/Response_handler";
import { OPS_Success, OPS_Error } from "../../../lib/ops/ops.factory";
import { Log } from "../../../utils/Logger";
import { CreateOrganizationPayload } from "./types";
import { AppDataSource } from "../../../config/database";
import { Organization } from "../../../entities/Organization";
import { OrgMembers } from "../../../entities/OrgMembers";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const EVENT  = "ORG_CREATE";
const SOURCE = "CreateOrganization_Operation";

// ─── CREATE ORGANIZATION OPERATION ────────────────────────────────────────────

export async function CreateOrganization_Operation(
  payload: CreateOrganizationPayload
): Promise<Service_Success_Handler | Service_Error_Handler> {

  const started_at = Date.now();

  const ops_base = {
    event:      EVENT,
    source:     SOURCE,
    actor_type: "ORG_ADMIN" as const,
    actor_id:   payload.creator_id,   // hashed inside OPS factory
    started_at,
    network:    payload.network,
    auth:       payload.auth,
    classification:  "INTERNAL"  as const,
    integrity_class: "SENSITIVE" as const,  // admin action, per your own enum comment
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // ── STEP 1: VALIDATE REQUIRED FIELDS ──────────────────────────────────────
    const { name, sector, email, visibility, creator_id } = payload;

    if (!name || !sector || !email || !creator_id) {
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

    // ── STEP 2: CHECK UNIQUENESS (org email) ───────────────────────────────────
    const orgRepo = queryRunner.manager.getRepository(Organization);
    const existingOrg = await orgRepo.findOne({ where: { email } });

    if (existingOrg) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status:         "OPERATION_FAILURE",
        message:        "An organization with this email already exists.",
        error_code:     "DUPLICATE_FIELD",
        error_category: "VALIDATION",
        retryable:      false,
        data:           { duplicate_field: "email" },
      });
    }

    // ── STEP 3: CREATE ORGANIZATION ────────────────────────────────────────────
    const newOrg = queryRunner.manager.create(Organization, {
      name,
      sector,
      email,
      // ensure optional fields use undefined (not null) to satisfy DeepPartial types
      company_logo:  payload.company_logo ?? undefined,
      visibility,
      primary_admin: { id: creator_id } as any,
    });
    const savedOrg = await queryRunner.manager.save(newOrg);

    // ── STEP 4: CREATE ADMIN MEMBERSHIP FOR CREATOR ─────────────────────────────
    // System-level authority (primary_admin) is separate from org-context
    // identity (OrgMembers). The creator needs both.
    const membership = queryRunner.manager.create(OrgMembers, {
      org:          { id: savedOrg.id } as any,
      user:         { id: creator_id }  as any,
      role:         "admin",
      status:       "active",
      verified_via: "org_creation",
      joined_at:    new Date(),
    });
    await queryRunner.manager.save(membership);

    await queryRunner.commitTransaction();

    // ── STEP 5: RETURN SUCCESS ─────────────────────────────────────────────────
    Log.info(SOURCE, "Organization created successfully", EVENT);

    return await OPS_Success({
      ...ops_base,
      org_id:  savedOrg.id,
      status:  "COMPLETED",
      message: "Organization created successfully.",
      data: {
        org: {
          id:         savedOrg.id,
          name:       savedOrg.name,
          email:      savedOrg.email,
          visibility: savedOrg.visibility,
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
      stack_ref:      `${EVENT}_${ops_base.started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}