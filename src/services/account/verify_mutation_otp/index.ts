// src/services/account/verify_mutation_otp/index.ts
import { VerifyOTP_Operation } from "../../helpers/otp_verify";
import { GenerateToken } from "../../../utils/auth";
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import { OPS_Success, OPS_Error } from "../../../lib/ops/ops.factory";
import { auth_generate_token_payload } from "../../../utils/types";
import { NetworkContext } from "../../../lib/ops/ops.types";

export async function VerifyMutationOTP_Operation(params: { userId: string; otp: string; network: NetworkContext }) {
  const started_at = Date.now();
  const ops_base = {
    event: "VERIFY_MUTATION_OTP", source: "VerifyMutationOTP_Operation",
    actor_type: "VOTER" as const, actor_id: params.userId, started_at, network: params.network,
    auth: { factors_used: ["OTP"], confidence: 1.0, mfa_verified: true },
    classification: "INTERNAL" as const, integrity_class: "SENSITIVE" as const,
  };

  const otp_check = await VerifyOTP_Operation({ userId: params.userId, otp: params.otp, network: params.network, caller: "VerifyMutationOTP_Operation" });
  if (!otp_check.success) {
    return await OPS_Error({ ...ops_base, status: "OPERATION_FAILURE", message: otp_check._OPS_MESSAGE, error_code: "INVALID_OTP", error_category: "VALIDATION", retryable: true });
  }

  const user = await AppDataSource.getRepository(User).findOneBy({ id: params.userId });
  if (!user) {
    return await OPS_Error({ ...ops_base, status: "OPERATION_FAILURE", message: "User not found.", error_code: "USER_NOT_FOUND", error_category: "VALIDATION", retryable: false });
  }

  // Deliberately short-lived — check GenerateToken's signature for a
  // per-call expiry override. If it doesn't support one yet, that's a
  // small addition needed before this ships: a 5–10 min expiry here,
  // NOT the same lifetime as a normal session token. A step-up
  // credential that lives as long as a login token defeats the point.
  const token_payload: auth_generate_token_payload = {
    id: user.id, username: user.username, email: user.email, network: params.network,
    verification: user.verification_status, user_status: user.user_status,
    range: "SELF_ACCOUNT_ACCESS",
  };
  const token = await GenerateToken(token_payload); // confirm 2nd arg matches your GenerateToken signature

  return await OPS_Success({ ...ops_base, status: "COMPLETED", message: "Verified. You may now update or delete your account.", data: { token } });
}