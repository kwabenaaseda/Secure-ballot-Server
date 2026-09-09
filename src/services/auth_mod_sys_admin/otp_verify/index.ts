import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { SystemAdmin } from '../../../entities/SystemAdmin';
import { generateOTP, verifyOTP } from '../../../utils/otp';
import { GenerateToken, Generate_Refresh_Token } from '../../../utils/auth';
import { sendOTPEmail } from '../../../workers/email.service';
import { NetworkContext } from '../../../lib/ops/ops.types';

const EVENT = 'SYSTEM_ADMIN_OTP_VERIFY';
const SOURCE = 'AdminVerifyOTP_Operation';

interface AdminVerifyOTPPayload {
  adminId: string;
  otp: string;
  network: NetworkContext;
}

// ── STEP 2 (OTP) of the admin MFA ladder ─────────────────────────────────────
// Completes sign-in: verifies the one-time code that AdminLogin_Operation
// emailed, then mints the access + refresh tokens. The JWT carries the
// SYSTEM_ADMIN range and the admin's level in `data.admin` (read by
// RequireSuperAdmin), matching the shape the pre-MFA login produced.
export async function AdminVerifyOTP_Operation(
  payload: AdminVerifyOTPPayload
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const { adminId, otp, network } = payload;

  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'SYSTEM_ADMIN' as const,
    actor_id: adminId,
    started_at,
    network,
    auth: {
      factors_used: ['OTP'],
      confidence: 1.0,
      mfa_verified: true,
    },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  try {
    if (!adminId || !otp) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Admin id and OTP are required.',
        error_code: 'MISSING_REQUIRED_FIELDS',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    const adminRepo = AppDataSource.getRepository(SystemAdmin);
    const admin = await adminRepo.findOneBy({ id: adminId });

    if (!admin) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Invalid sign-in attempt.',
        error_code: 'ADMIN_NOT_FOUND',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    if (admin.status !== 'active') {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'This admin account has been suspended.',
        error_code: 'ACCOUNT_SUSPENDED',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    // OTP is hashed + single-use + 10-minute TTL (see utils/otp.ts). A wrong
    // attempt deletes nothing and simply fails; a correct attempt consumes it.
    const valid = await verifyOTP(admin.id, otp);
    if (!valid) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Invalid or expired code.',
        error_code: 'INVALID_OTP',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    // Admins are always treated as verified/green — they were vetted at
    // onboarding time and pass the OTP step here.
    const token = await GenerateToken({
      id: admin.id,
      email: admin.email,
      username: admin.username,
      range: 'SYSTEM_ADMIN',
      verification: 'verified',
      user_status: 'green',
      network,
      data: { admin: admin.level }, // "admin" | "super_admin" — read by RequireSuperAdmin
    });

    if (typeof token !== 'string') {
      return await OPS_Error({
        ...ops_base,
        status: 'SYSTEM_FAILURE',
        message: 'Failed to generate session token.',
        error_code: 'TOKEN_GENERATION_FAILED',
        error_category: 'SYSTEM',
        retryable: true,
      });
    }

    const refresh_token = await Generate_Refresh_Token({ id: admin.id });

    Log.info(SOURCE, 'System admin MFA verified; session issued', EVENT);

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Sign-in complete.',
      data: {
        token,
        refresh_token,
        admin: { id: admin.id, email: admin.email, username: admin.username, level: admin.level },
      },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: `An unexpected error occurred during ${EVENT}. `,
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${started_at}`,
    });
  }
}
// ── Resend: lets an admin request a fresh code (e.g. it expired / never arrived)
interface AdminResendOTPPayload {
  adminId: string;
  network: NetworkContext;
}

export async function AdminResendOTP_Operation(
  payload: AdminResendOTPPayload
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const { adminId, network } = payload;

  const ops_base = {
    event: 'SYSTEM_ADMIN_OTP_RESEND',
    source: SOURCE,
    actor_type: 'SYSTEM_ADMIN' as const,
    actor_id: adminId,
    started_at,
    network,
    auth: {
      factors_used: ['OTP'],
      confidence: 0.5,
      mfa_verified: false,
    },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  try {
    if (!adminId) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Admin id is required.',
        error_code: 'MISSING_REQUIRED_FIELDS',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    const adminRepo = AppDataSource.getRepository(SystemAdmin);
    const admin = await adminRepo.findOneBy({ id: adminId });

    if (!admin || admin.status !== 'active') {
      // Deliberately vague — do not confirm whether an admin id exists.
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Unable to resend a code for this account.',
        error_code: 'RESEND_UNAVAILABLE',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const otp = await generateOTP(admin.id);
    sendOTPEmail({ to: admin.email, username: admin.username, otp }).catch((err) =>
      Log.debug(SOURCE, `Admin OTP email failed: ${err}`, EVENT)
    );

    Log.info(SOURCE, 'System admin OTP resent', EVENT);

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'A new code has been sent to your email.',
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: `An unexpected error occurred during OTP resend. `,
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${started_at}`,
    });
  }
}