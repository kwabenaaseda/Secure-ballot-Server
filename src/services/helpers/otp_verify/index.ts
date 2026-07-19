import { OPS_Error, OPS_Success } from "../../../lib/ops/ops.factory";
import { NetworkContext } from "../../../lib/ops/ops.types";
import { Service_Success_Handler, Service_Error_Handler } from "../../../types/Response_handler";
import { CLOCK, Log } from "../../../utils/Logger";
import { verifyOTP } from "../../../utils/otp";

const EVENT = "OTP_VERIFICATION_HELPER"
const SOURCE = 'VERIFYOTP_OPERATION'


export async function VerifyOTP_Operation(
  params:{
   userId: string,
   otp: string,
   network:NetworkContext,
   caller: string
 }
): Promise<Service_Success_Handler | Service_Error_Handler> {

  Log.info(SOURCE,'OTP_Verification_helper initiated', EVENT)

    const started_at = Date.now();
     const ops_base = {
    event:      EVENT,
    source:     SOURCE,
    actor_type: "SYSTEM" as const,   // pre-auth — no actor identity yet
    actor_id:  params.caller ,       // hashed inside OPS factory
    started_at,
    network:  params.network  ,
    auth: {
      factors_used: ["OTP"],
      confidence:   1.0,
      mfa_verified: false,           // OTP verification is a separate operation
    },
    classification:  "INTERNAL"  as const,
    integrity_class: "SENSITIVE" as const,
  };

  try {
    const {userId,otp} = params 

    // ── STEP 1: VALIDATE ─────────────────────────────────
    if (!otp || !userId) {
      Log.info(SOURCE,'OTP_Verification_helper completed', EVENT)
      return await OPS_Error({
              ...ops_base,
              status: "OPERATION_FAILURE",
              message: "All required fields must be provided.",
              error_code: "MISSING_REQUIRED_FILEDS",
              error_category:"VALIDATION",
              retryable: true
            })

    }

    // ── STEP 2: VERIFY OTP ───────────────────────────────
    const is_valid = await verifyOTP(userId, otp);

    if (!is_valid) {
      Log.info(SOURCE,'OTP_Verification_helper completed', EVENT)

       return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "Invalid or expired OTP",
        error_code: "INVALID_FIELDS",
        error_category:"VALIDATION",
        retryable: true
      })
    }

    Log.info(SOURCE,'OTP_Verification_helper completed', EVENT)
    
    return await OPS_Success({
      ...ops_base,
      actor_id: params.caller,
      actor_type: "SYSTEM",
      status: "COMPLETED",
      message: 'OTP VERIFIED SUCCESSFULLY',

    })

  } catch (error) {
    Log.info(SOURCE,'OTP_Verification_helper terminated', EVENT)
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
  }
}