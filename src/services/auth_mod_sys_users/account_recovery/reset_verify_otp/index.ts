import { Service_Success_Handler, Service_Error_Handler } from "../../../../types/Response_handler";
import { CLOCK, Log } from "../../../../utils/Logger";
import { AppDataSource } from "../../../../config/database";
import { User } from "../../../../entities/User";
import { VerifyOTP_Operation } from "../../../helpers/otp_verify";
import { GenerateToken } from "../../../../utils/auth";
import { NetworkContext } from "../../../../lib/ops/ops.types";
import { OPS_Error, OPS_Success } from "../../../../lib/ops/ops.factory";

const EVENT = "RESET_PASSWORD_VERIFY_OTP"
const SOURCE = "VERIFY_RESET_PASSWORD_OTP"

export async function Verify_Reset_Password_OTP(
  params: {
    userId: string,
    otp: string,
    network: NetworkContext
  }
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now()

  const ops_base = {
    event : EVENT,
    source: SOURCE,
    actor_type: "SYSTEM" as const,
    actor_id: params.userId,
    started_at: started_at,
    network: params.network,
    auth:{
      factors_used: ["OTP"],
      confidence: 1.0,
      mfa_verified: true
    },
    classification: "INTERNAL" as const,
    integrity_class: "SENSITIVE" as const
  };

  try {
    const {userId, otp} = params
    // ── STEP 1: VALIDATE ─────────────────────────────────
    if (!otp || !userId) {
      return await OPS_Error({
        ...ops_base,
        status:"OPERATION_FAILURE",
        message: "All required fields must be provided",
        error_code: "MISSING_REQUIRED_FIELDS",
        error_category: "VALIDATION",
        retryable: true
            })
    }

    // ── STEP 2: VERIFY OTP ───────────────────────────────
    const is_valid = await VerifyOTP_Operation({...params,caller:SOURCE})

    if (is_valid.success == false) {
      return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: is_valid._OPS_MESSAGE,
        error_code: "MISSING_REQUIRED_FILEDS",
        error_category:"VALIDATION",
        retryable: true,
      })
    }

    // ── STEP 3: Find user and Generate Tokens ───────────────
    const userRepository = AppDataSource.getRepository(User);
    const _user = await userRepository.findOne({
        where: {id: userId}
    })

    if (!_user){
        return await OPS_Error({
        ...ops_base,
        status: "OPERATION_FAILURE",
        message: "Unkown User",
        error_code: "MISSING_REQUIRED_FILEDS",
        error_category:"VALIDATION",
        retryable: true,
      })
    }
    // Token Generation
    const token = await GenerateToken({id:_user.id,email:_user.email,username:_user.username,range:"reset"})


    Log.info(Verify_Reset_Password_OTP.name, "Reset OTP verified successfully", "RESET_OTP_VERIFY");


    return await OPS_Success({
          ...ops_base,
          actor_id: _user?.id,
          actor_type: "VOTER",
          status: "COMPLETED",
          message: "Reset OTP verified successfully. Temporary Access Granted to reset password. Expires in 5 minutes",
          data: {
            token
          }
        })

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
  }
}