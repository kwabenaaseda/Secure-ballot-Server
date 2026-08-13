// src/services/auth_mod_sys_users/otp_verify/index.ts
import { Service_Success_Handler, Service_Error_Handler } from "../../../types/Response_handler";
import { Log } from "../../../utils/Logger";
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import { VerifyOTP_Operation } from "../../helpers/otp_verify";
import { NetworkContext } from "../../../lib/ops/ops.types";
import { OPS_Error, OPS_Success } from "../../../lib/ops/ops.factory";
import { GenerateToken, Generate_Refresh_Token } from "../../../utils/auth";
import { auth_generate_token_payload } from "../../../utils/types";
import Operations_Manager from "../../../utils/ops.manager";

const EVENT = "OTP_VERIFICATION";
const SOURCE = "VerifyAccount_Operation";

export async function VerifyAccount_Operation(
  params: { userId: string; otp: string; network: NetworkContext }
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: "SYSTEM" as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: {
      factors_used: ["OTP"],   // fixed — was wrongly "PASSWORD"
      confidence: 1.0,
      mfa_verified: true,
    },
    classification: "INTERNAL" as const,
    integrity_class: "SENSITIVE" as const,
  };

  try {
    const { userId, otp } = params;

    // ── STEP 1: VALIDATE ─────────────────────────────────
    if (!otp || !userId) {
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "All required fields must be provided.",
        error_code: "MISSING_REQUIRED_FIELDS",
        error_category: "VALIDATION",
        retryable: true,
      });
    }

    // ── STEP 2: VERIFY OTP ───────────────────────────────
    const otp_check = await VerifyOTP_Operation({ ...params, caller: SOURCE });

    if (!otp_check.success) {
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: otp_check._OPS_MESSAGE,
        error_code: "INVALID_OTP",
        error_category: "VALIDATION",
        retryable: true,
      });
    }

    // ── STEP 3: PROMOTE VERIFICATION STATUS ──────────────
    const userRepository = AppDataSource.getRepository(User);
    await userRepository.update(userId, { verification_status: "verified" });

    // ── STEP 4: RECOMPUTE ROLE, REISSUE TOKEN ────────────
    // A JWT is a signed snapshot — the old PART token doesn't update itself.
    // Reissuing here is what actually unlocks FULL access for the client.
    const user = await userRepository.findOneBy({ id: userId });
    if (!user) {
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "User not found during verification promotion.",
        error_code: "USER_NOT_FOUND",
        error_category: "VALIDATION",
        retryable: false,
      });
    }

    const ops = await Operations_Manager({ user_id: user.id, location: "domestic" });
    if (ops === false) {
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "Unable to resolve access profile after verification.",
        error_code: "PROFILE_RESOLUTION_FAILED",
        error_category: "AUTH",
        retryable: true,
      });
    }

    const token_payload: auth_generate_token_payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      network: params.network,
      verification: user.verification_status,
      user_status: user.user_status,
      range: ops.role, // now ACCOUNT_ACCESS[FULL]
    };

    const token = await GenerateToken(token_payload);
    const refresh_token = await Generate_Refresh_Token({ id: user.id });

    Log.info(SOURCE, "Account fully verified", EVENT);

    return await OPS_Success({
      ...ops_base,
      actor_id: user.id,
      actor_type: "VOTER",
      status: "COMPLETED",
      message: "Account verified successfully.",
      data: { token, refresh_token },
    });

  } catch (error) {
    Log.debug(SOURCE, String(error), EVENT);

    return await OPS_Error({
      ...ops_base,
      status: "SYSTEM_FAILURE",
      message: `An unexpected error occurred during ${EVENT}. `,
      error_code: "INTERNAL_ERROR",
      error_category: "SYSTEM",
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${ops_base.started_at}`,
    });
  }
}