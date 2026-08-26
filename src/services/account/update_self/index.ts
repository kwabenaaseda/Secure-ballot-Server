// src/services/account/update_self/index.ts
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import Operations_Manager, { Authorize } from "../../../utils/ops.manager";
import { OPS_Success, OPS_Error } from "../../../lib/ops/ops.factory";
import { NetworkContext } from "../../../lib/ops/ops.types";

// Fields a user may self-edit. Deliberately excludes email/telephone/
// username (those are identity anchors tied to uniqueness constraints
// and OTP delivery — changing them needs its own dedicated, more
// carefully-guarded flow, not a generic PATCH) and verification_status/
// user_status (those are system-controlled, never user-writable).
const EDITABLE_FIELDS = ["date_of_birth", "nationality", "occupation", "fields_of_interest", "profile_picture"] as const;

export async function UpdateSelf_Operation(params: { userId: string; role: string; updates: Record<string, any>; network: NetworkContext }) {
  const started_at = Date.now();
  const ops_base = {
    event: "UPDATE_SELF_ACCOUNT", source: "UpdateSelf_Operation",
    actor_type: "VOTER" as const, actor_id: params.userId, started_at, network: params.network,
    auth: { factors_used: ["OTP", "JWT"], confidence: 1.0, mfa_verified: true },
    classification: "INTERNAL" as const, integrity_class: "SENSITIVE" as const,
  };

  if (!Authorize(params.role as any, "account.self", "update")) {
    return await OPS_Error({ ...ops_base, status: "OPERATION_FAILURE", message: "Step-up verification required.", error_code: "FORBIDDEN", error_category: "AUTH", retryable: false });
  }

  const patch: Record<string, any> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in params.updates) patch[key] = params.updates[key];
  }
  if (Object.keys(patch).length === 0) {
    return await OPS_Error({ ...ops_base, status: "OPERATION_FAILURE", message: "No editable fields provided.", error_code: "NO_VALID_FIELDS", error_category: "VALIDATION", retryable: true });
  }

  await AppDataSource.getRepository(User).update(params.userId, patch);

  return await OPS_Success({ ...ops_base, status: "COMPLETED", message: "Account updated.", data: { updated_fields: Object.keys(patch) } });
}