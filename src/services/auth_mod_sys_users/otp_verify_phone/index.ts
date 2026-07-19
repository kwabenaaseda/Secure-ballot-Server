import { Service_Success_Handler, Service_Error_Handler } from "../../../types/Response_handler";
import { CLOCK, Log } from "../../../utils/Logger";
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import { verifyOTP } from "../../../utils/otp";
import { VerifyOTP_Operation } from "../../helpers/otp_verify";
import { NetworkContext } from "../../../lib/ops/ops.types";
import { OPS_Error, OPS_Success } from "../../../lib/ops/ops.factory";


const EVENT = "PHONE_OTP_VERIFICATION";
const SOURCE = "VERIFY_PHONE_OPERATION";


export async function VerifyPhone_Operation(
  params:{
  userId: string,
  otp: string,
  network:NetworkContext
}
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = {
    event:      EVENT,
    source:     SOURCE,
    actor_type: "SYSTEM" as const,   // pre-auth — no actor identity yet
    actor_id:  params.userId ,       // hashed inside OPS factory
    started_at,
    network:  params.network  ,
    auth: {
      factors_used: ["PASSWORD"],
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
    const is_valid = await VerifyOTP_Operation({...params,caller:SOURCE})

    if (!is_valid.success) {
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: is_valid._OPS_MESSAGE,
        error_code: "MISSING_REQUIRED_FILEDS",
        error_category:"VALIDATION",
        retryable: true,
      })
    }

    // ── STEP 3: UPDATE VERIFICATION STATUS ───────────────
    const userRepository = AppDataSource.getRepository(User);
    await userRepository.update(userId, {
      verification_status: "phone_verified",
    });

    Log.info(VerifyPhone_Operation.name, "Phone verified successfully", "OTP_VERIFY");

    return await OPS_Success({
      ...ops_base,
      actor_id: userId,
      actor_type: "VOTER",
      status: "COMPLETED",
      message: "PHONE VERIFIED SUCCESSFULLY",
    })

  } catch (error) {
    Log.debug(VerifyPhone_Operation.name, String(error), "OTP_VERIFY");

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