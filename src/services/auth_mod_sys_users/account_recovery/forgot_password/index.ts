// This module handles the forgot password service implementation

import { AppDataSource } from "../../../../config/database";
import { User } from "../../../../entities/User";
import { OPS_Error, OPS_Success } from "../../../../lib/ops/ops.factory";
import { NetworkContext } from "../../../../lib/ops/ops.types";
import { Service_Error_Handler, Service_Success_Handler } from "../../../../types/Response_handler";
import { CLOCK, Log } from "../../../../utils/Logger";
import { generateOTP } from "../../../../utils/otp";
import { sendPasswordResetEmail } from "../../../../workers/email.service";
import { sendOTPSMS } from "../../../../workers/messenger.service";
import { sendOTPSMS_TextBelt } from "../../../../workers/textbelt.sms.service";
import { ResetPayload } from "./types";

const EVENT = 'FORGOT_PASSWORD'
const SOURCE = Forgot_Password.name

export async function Forgot_Password(
    payload: ResetPayload,
    network: NetworkContext
): Promise<Service_Success_Handler|Service_Error_Handler> {

    const started_at = Date.now();

  // Base OPS context shared across all return paths in this operation
  const ops_base = {
    event:      EVENT,
    source:     SOURCE,
    actor_type: "SYSTEM" as const,   // pre-auth — no actor identity yet
    actor_id:   payload.identifier,       // hashed inside OPS factory
    started_at,
    network:   network,
    auth: {
      factors_used: ["PASSWORD"],
      confidence:   1.0,
      mfa_verified: false,           // OTP verification is a separate operation
    },
    classification:  "INTERNAL"  as const,
    integrity_class: "SENSITIVE" as const,
  };



    try {
        const { identifier } = payload

        // ── STEP 0: VALIDATE FIELDS ──────────────────────────
        if (!identifier) {
            Log.info(Forgot_Password.name, "Invalid user credentials", "FORGOT PASSWORD")
            return await OPS_Error({
                    ...ops_base,
                    status:          "OPERATION_FAILURE",
                    message:         "All required fields must be provided.",
                    error_code:      "MISSING_REQUIRED_FIELDS",
                    error_category:  "VALIDATION",
                    retryable:       true,
                  });
        }

        // ── STEP 1: FIND USER (EMAIL / USERNAME) ──────────────────────────
        const userRepository = AppDataSource.getRepository(User);

        const user = await userRepository.findOne({
            where: [
                { email: identifier },
                { username: identifier }
            ]
        })

        // ── STEP 1.1: USER NOT FOUND ──────────────────────────

        if (!user) {
            return await OPS_Error({
                    ...ops_base,
                    status:          "OPERATION_FAILURE",
                    message:         "Invalid credentials",
                    error_code:      "MISSING_REQUIRED_FIELDS",
                    error_category:  "VALIDATION",
                    retryable:       true,
                  });
        }
        // ── STEP 2: GENERATE OTP (Store in memory 5 mins) ──────────────────────────
        const otp = await generateOTP(user.id)
        // ── STEP 3: SEND OTP ──────────────────────────
        sendPasswordResetEmail({
            to: user.email,
            username: user.username,
            otp
        }).catch((error) => {
            Log.debug(Forgot_Password.name, `Failed to send password reset email: ${error.message}`, "FORGOT PASSWORD")
        });

        sendOTPSMS(user.telephone, otp).catch((err) =>
      Log.debug(Forgot_Password.name, `OTP SMS failed: ${err}`, "FORGOT PASSWORD")
    );
    // -- Testing textbelt
    sendOTPSMS_TextBelt(user.telephone, `Your password reset OTP is: ${otp}`).catch((err) =>
      Log.debug(Forgot_Password.name, `TextBelt OTP SMS failed: ${err}`, "FORGOT PASSWORD")
    );

        // ── STEP 4: FORMULATE RESPONSE ──────────────────────────


        // ── STEP 5: RETURN RESPONSE ──────────────────────────
        Log.info(Forgot_Password.name, "FORGOT PASSWORD Successful", "FORGOT PASSWORD");

       return await OPS_Success({
      ...ops_base,
      // Now we know the actor — update from email to real user ID
      actor_id:   user.id,
      actor_type: "VOTER",
      status:     "COMPLETED",
      message:    "Signup successful. OTP sent to email and phone.",
    });

    } catch (error) {
       Log.debug(SOURCE, String(error), EVENT);
      
         return await OPS_Error({
                  ...ops_base,
                  status:         "SYSTEM_FAILURE",
                  message:        `An unexpected error occurred during ${EVENT}. `,
                  error_code:     "INTERNAL_ERROR",
                  error_category: "SYSTEM",
                  retryable:      true,
                  retry_after_ms: 5000,
                  stack_ref:      `${EVENT}_${ops_base.started_at}`, // references internal log, not raw stack
                });
           };
}