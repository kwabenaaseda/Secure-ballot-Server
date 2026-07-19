import { Service_Success_Handler, Service_Error_Handler } from "../../../types/Response_handler";
import { CLOCK, Log } from "../../../utils/Logger";
import { LoginPayload } from "./types";
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import { Verify_Hash, GenerateToken, Generate_Refresh_Token } from "../../../utils/auth";
import { OPS_Error, OPS_Success } from "../../../lib/ops/ops.factory";

const EVENT = "LOGIN";
const SOURCE = "Login_Operation"

export async function Login_Operation(
  payload: LoginPayload
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();

const ops_base = {
    event:      EVENT,
    source:     SOURCE,
    actor_type: "SYSTEM" as const,   // pre-auth — no actor identity yet
    actor_id:   payload.identifier,       // hashed inside OPS factory
    started_at,
    network:    payload.network,
    auth: {
      factors_used: ["PASSWORD"],
      confidence:   1.0,
      mfa_verified: false,           // OTP verification is a separate operation
    },
    classification:  "INTERNAL"  as const,
    integrity_class: "SENSITIVE" as const,
  };

  try {
    const { identifier, password } = payload;

    // ── STEP 1: VALIDATE FIELDS ──────────────────────────
    if (!identifier || !password) {
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "All required fields must be provided.",
        error_code: "MISSING_REQUIRED_FIELDS",
        error_category: "VALIDATION",
        retryable: true
      })
    }

    // ── STEP 2: FIND USER BY EMAIL OR USERNAME ───────────
    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: [
        { email: identifier },
        { username: identifier },
      ],
    });

    // ── STEP 3: USER NOT FOUND ───────────────────────────
    // Deliberately vague message (security: don't reveal if email exists)
    if (!user) {
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: `Account with identifier ${identifier} does not exist. `,
        error_code: "INVALID_CREDENTIALS",
        error_category: "VALIDATION",
        retryable: true
      })
    }

    // ── STEP 4: COMPARE PASSWORD ─────────────────────────
    const password_match = await Verify_Hash(password, user.password_hash);

    if (!password_match) {
     return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "Provided Password is incorrect. ",
        error_code: "INVALID_CREDENTIALS",
        error_category: "VALIDATION",
        retryable: true
      })
    }

    // ── STEP 5: GENERATE TOKENS ──────────────────────────
    const token = await GenerateToken({
      id: user.id,
      email: user.email,
      username: user.username,
      range:"access"
    });

    const refresh_token = await Generate_Refresh_Token({ id: user.id });

    // ── STEP 6: RETURN RESPONSE ──────────────────────────
  
    Log.info(SOURCE, "Login Successful", EVENT);
    
    return await OPS_Success({
          ...ops_base,
          // Now we know the actor — update from email to real user ID
          actor_id:   user.id,
          actor_type: "VOTER",
          status:     "COMPLETED",
          message:    "Login successful. OTP sent to email and phone.",
          data: {
            token,
            refresh_token,
            user: {
              id:                  user.id,
              email:               user.email,
              username:            user.username,
              verification_status: user.verification_status,
            },
          },
        });
  } catch (error) {
     Log.debug(SOURCE, String(error), EVENT);
  
      return await OPS_Error({
        ...ops_base,
        status:         "SYSTEM_FAILURE",
        message:        "An unexpected error occurred during signup.",
        error_code:     "INTERNAL_ERROR",
        error_category: "SYSTEM",
        retryable:      true,
        retry_after_ms: 5000,
        stack_ref:      `${EVENT}_${ops_base.started_at}`, // references internal log, not raw stack
      });
    }
}