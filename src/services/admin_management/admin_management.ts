import { Service_Error_Handler, Service_Success_Handler } from "../../types/Response_handler";
import { OPS_Success, OPS_Error } from "../../lib/ops/ops.factory";
import { Log } from "../../utils/Logger";
import { AppDataSource } from "../../config/database";
import { User } from "../../entities/User";
import { Organization } from "../../entities/Organization";
import { NetworkContext } from "../../lib/ops/ops.types";

const SOURCE = "AdminManagement_Operation";

function base(event: string, admin_id: string, network: NetworkContext) {
  return {
    event, source: SOURCE,
    actor_type: "SYSTEM_ADMIN" as const,
    actor_id: admin_id,
    started_at: Date.now(),
    network,
    auth: { factors_used: ["SESSION"], confidence: 1.0, mfa_verified: false },
    classification:  "INTERNAL"  as const,
    integrity_class: "SENSITIVE" as const,
  };
}

// ── LIST USERS (with optional verification_status filter) ──────────────────
export async function ListUsers_Operation(
  payload: { admin_id: string; network: NetworkContext; verification_status?: User['verification_status'] }
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base("ADMIN_LIST_USERS", payload.admin_id, payload.network);
  try {
    const repo = AppDataSource.getRepository(User);
    const where = payload.verification_status ? { verification_status: payload.verification_status } : {};
    const users = await repo.find({
      where,
      select: ["id", "email", "username", "verification_status", "user_status", "created_at"],
      order: { created_at: "DESC" },
      take: 100,
    });
    return await OPS_Success({ ...ops_base, status: "COMPLETED", message: "Users retrieved.", data: { users, count: users.length } });
  } catch (error) {
    Log.debug(SOURCE, String(error), "ADMIN_LIST_USERS");
    return await OPS_Error({
      ...ops_base, status: "SYSTEM_FAILURE", message: "Failed to retrieve users.",
      error_code: "INTERNAL_ERROR", error_category: "SYSTEM", retryable: true, retry_after_ms: 5000,
      stack_ref: `ADMIN_LIST_USERS_${ops_base.started_at}`,
    });
  }
}

// ── SET USER STATUS (green/yellow/red) — moderation action ─────────────────
export async function SetUserStatus_Operation(
  payload: { admin_id: string; network: NetworkContext; user_id: string; user_status: User['user_status'] }
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base("ADMIN_SET_USER_STATUS", payload.admin_id, payload.network);
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const repo = queryRunner.manager.getRepository(User);
    const user = await repo.findOneBy({ id: payload.user_id });
    if (!user) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base, status: "OPERATION_FAILURE", message: "User not found.",
        error_code: "USER_NOT_FOUND", error_category: "VALIDATION", retryable: false,
      });
    }
    user.user_status = payload.user_status;
    await queryRunner.manager.save(user);
    await queryRunner.commitTransaction();
    Log.info(SOURCE, `User ${user.id} status set to ${payload.user_status}`, "ADMIN_SET_USER_STATUS");
    return await OPS_Success({
      ...ops_base, status: "COMPLETED", message: "User status updated.",
      data: { user_id: user.id, user_status: user.user_status },
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), "ADMIN_SET_USER_STATUS");
    return await OPS_Error({
      ...ops_base, status: "SYSTEM_FAILURE", message: "Failed to update user status.",
      error_code: "INTERNAL_ERROR", error_category: "SYSTEM", retryable: true, retry_after_ms: 5000,
      stack_ref: `ADMIN_SET_USER_STATUS_${ops_base.started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}

// ── LIST ORGANIZATIONS ───────────────────────────────────────────────────────
export async function ListOrganizations_Operation(
  payload: { admin_id: string; network: NetworkContext }
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base("ADMIN_LIST_ORGS", payload.admin_id, payload.network);
  try {
    const repo = AppDataSource.getRepository(Organization);
    const orgs = await repo.find({ order: { name: "ASC" }, take: 100 });
    return await OPS_Success({ ...ops_base, status: "COMPLETED", message: "Organizations retrieved.", data: { organizations: orgs, count: orgs.length } });
  } catch (error) {
    Log.debug(SOURCE, String(error), "ADMIN_LIST_ORGS");
    return await OPS_Error({
      ...ops_base, status: "SYSTEM_FAILURE", message: "Failed to retrieve organizations.",
      error_code: "INTERNAL_ERROR", error_category: "SYSTEM", retryable: true, retry_after_ms: 5000,
      stack_ref: `ADMIN_LIST_ORGS_${ops_base.started_at}`,
    });
  }
}