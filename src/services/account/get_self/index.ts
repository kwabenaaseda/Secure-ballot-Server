// src/services/account/get_self/index.ts
import { Service_Success_Handler, Service_Error_Handler } from "../../../types/Response_handler";
import { OPS_Success, OPS_Error } from "../../../lib/ops/ops.factory";
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import Operations_Manager, { Authorize } from "../../../utils/ops.manager";
import { NetworkContext } from "../../../lib/ops/ops.types";

const EVENT = "GET_SELF_ACCOUNT";
const SOURCE = "GetSelf_Operation";

export async function GetSelf_Operation(params: { userId: string; network: NetworkContext }) {
  const started_at = Date.now();
  const ops_base = {
    event: EVENT, source: SOURCE, actor_type: "VOTER" as const, actor_id: params.userId,
    started_at, network: params.network,
    auth: { factors_used: ["JWT"], confidence: 1.0, mfa_verified: false },
    classification: "INTERNAL" as const, integrity_class: "STANDARD" as const,
  };

  try {
    const ops = await Operations_Manager({ user_id: params.userId, location: "domestic" });
    if (ops === false) {
      return await OPS_Error({ ...ops_base, status: "OPERATION_FAILURE", message: "Unable to resolve access profile.", error_code: "PROFILE_RESOLUTION_FAILED", error_category: "AUTH", retryable: true });
    }
    if (!Authorize(ops.role, "account.self", "read")) {
      return await OPS_Error({ ...ops_base, status: "OPERATION_FAILURE", message: "Not authorized.", error_code: "FORBIDDEN", error_category: "AUTH", retryable: false });
    }

    const user = await AppDataSource.getRepository(User).findOneBy({ id: params.userId });
    if (!user) {
      return await OPS_Error({ ...ops_base, status: "OPERATION_FAILURE", message: "User not found.", error_code: "USER_NOT_FOUND", error_category: "VALIDATION", retryable: false });
    }

    // NEVER return password_hash or biometric_hash — even hashed, these
    // should never leave the server. Whitelist fields explicitly rather
    // than destructuring-and-omitting, so a new sensitive column added
    // later to the entity doesn't accidentally leak by default.
    return await OPS_Success({
      ...ops_base, status: "COMPLETED", message: "Account details retrieved.",
      data: {
        email: user.email,
        telephone: user.telephone, 
        username: user.username,
        date_of_birth: user.date_of_birth, 
        nationality: user.nationality, 
        occupation: user.occupation,
        fields_of_interest: user.fields_of_interest, 
        profile_picture: user.profile_picture,
        verification_status: user.verification_status, 
        user_status: user.user_status,
      },
    });
  } catch (error) {
    return await OPS_Error({ ...ops_base, status: "SYSTEM_FAILURE", message: `Unexpected error during ${EVENT}.`, error_code: "INTERNAL_ERROR", error_category: "SYSTEM", retryable: true, retry_after_ms: 5000, stack_ref: `${EVENT}_${started_at}` });
  }
}