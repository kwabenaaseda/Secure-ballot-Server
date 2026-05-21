import { Service_Success_Handler, Service_Error_Handler } from "../../../types/Response_handler";
import { CLOCK, Log } from "../../../utils/Logger";
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import { verifyOTP } from "../../../utils/otp";

export async function VerifyOTP_Operation(
  userId: string,
  otp: string
): Promise<Service_Success_Handler | Service_Error_Handler> {
  try {
    // ── STEP 1: VALIDATE ─────────────────────────────────
    if (!otp || !userId) {
      return {
        _OPS_STATS: "OPERATION FAILURE",
        _OPS_META: {
          _timestamp: CLOCK(),
          _event: "OTP_VERIFY",
          _source: VerifyOTP_Operation.name,
        },
        success: false,
        _OPS_MESSAGE: "OTP and user ID are required.",
      };
    }

    // ── STEP 2: VERIFY OTP ───────────────────────────────
    const is_valid = await verifyOTP(userId, otp);

    if (!is_valid) {
      return {
        _OPS_STATS: "OPERATION FAILURE",
        _OPS_META: {
          _timestamp: CLOCK(),
          _event: "OTP_VERIFY",
          _source: VerifyOTP_Operation.name,
        },
        success: false,
        _OPS_MESSAGE: "Invalid or expired OTP.",
      };
    }

    // ── STEP 3: UPDATE VERIFICATION STATUS ───────────────
    const userRepository = AppDataSource.getRepository(User);
    await userRepository.update(userId, {
      verification_status: "phone_verified",
    });

    Log.info(VerifyOTP_Operation.name, "Phone verified successfully", "OTP_VERIFY");

    return {
      _OPS_STATS: "COMPLETED",
      _OPS_META: {
        _timestamp: CLOCK(),
        _event: "OTP_VERIFY",
        _source: VerifyOTP_Operation.name,
      },
      _OPS_MESSAGE: "Phone verified successfully.",
      success: true,
    };

  } catch (error) {
    Log.debug(VerifyOTP_Operation.name, String(error), "OTP_VERIFY");

    return {
      _OPS_STATS: "SYSTEM FAILURE",
      _OPS_META: {
        _timestamp: CLOCK(),
        _event: "OTP_VERIFY",
        _source: VerifyOTP_Operation.name,
      },
      success: false,
      _OPS_MESSAGE: "Unknown Error in OTP Verification.",
    };
  }
}