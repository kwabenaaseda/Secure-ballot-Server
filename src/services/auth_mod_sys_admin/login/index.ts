import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { SystemAdmin } from '../../../entities/SystemAdmin';
import { Verify_Hash, GenerateToken, Generate_Refresh_Token } from '../../../utils/auth';
import { generateOTP } from '../../../utils/otp';
import { sendOTPEmail } from '../../../workers/email.service';
import { NetworkContext } from '../../../lib/ops/ops.types';

const EVENT = 'SYSTEM_ADMIN_LOGIN';
const SOURCE = 'AdminLogin_Operation';

interface AdminLoginPayload {
  email: string;
  password: string;
  network: NetworkContext;
}

export async function AdminLogin_Operation(
  payload: AdminLoginPayload
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const { email, password, network } = payload;

  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'SYSTEM' as const,
    actor_id: email,
    started_at,
    network,
    auth: {
      factors_used: ['PASSWORD'],
      confidence: 1.0,
      mfa_verified: false,
    },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  try {
    if (!email || !password) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Email and password are required.',
        error_code: 'MISSING_REQUIRED_FIELDS',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    const adminRepo = AppDataSource.getRepository(SystemAdmin);
    const admin = await adminRepo.findOneBy({ email });

    // Deliberately identical failure message whether the email doesn't
    // exist or the password is wrong — no user-enumeration signal.
    if (!admin) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Invalid credentials.',
        error_code: 'INVALID_CREDENTIALS',
        error_category: 'AUTH',
        retryable: true,
      });
    }

    const valid = await Verify_Hash(password, admin.password_hash);
    if (!valid) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Invalid credentials.',
        error_code: 'INVALID_CREDENTIALS',
        error_category: 'AUTH',
        retryable: true,
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

    // ── STEP 1 (PASSWORD): PASSED ──────────────────────────────────────────
    // MFA: credentials are verified. Generate OTP and a short-lived PART token.
    // The PART token is required for /verify-otp to extract the admin ID.
    const otp = await generateOTP(admin.id);

    // Generate PART token (8 minute expiry) - mirrors user login flow
    const token = await GenerateToken({
      id: admin.id,
      email: admin.email,
      username: admin.username,
      range: 'SYSTEM_ADMIN[PART]',
      verification: 'verified',
      user_status: 'green',
      network,
      data: { level: admin.level },
    });

    const refresh_token = await Generate_Refresh_Token({ id: admin.id });

    // Non-blocking — the login response must not wait on email delivery.
    sendOTPEmail({ to: admin.email, username: admin.username, otp }).catch((err) =>
      Log.debug(SOURCE, `Admin OTP email failed: ${err}`, EVENT)
    );

    Log.info(SOURCE, 'System admin credentials verified; OTP dispatched; PART token issued', EVENT);

    return await OPS_Success({
      ...ops_base,
      actor_id: admin.id,
      status: 'COMPLETED',
      message: 'Credentials verified. Enter the one-time code sent to your email to complete sign-in.',
      data: {
        token,
        refresh_token,
        mfa_required: true,
        mfa_channel: 'email',
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
