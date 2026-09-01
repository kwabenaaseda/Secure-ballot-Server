import { AppDataSource } from '../../../config/database';
import { User } from '../../../entities/User';
import { OPS_Error, OPS_Success } from '../../../lib/ops/ops.factory';
import { NetworkContext } from '../../../lib/ops/ops.types';
import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { Log } from '../../../utils/Logger';
import Operations_Manager, { ACTION, LOCATION, RESOURCE } from '../../../utils/ops.manager';
import { generateOTP } from '../../../utils/otp';
import { sendOTPEmail } from '../../../workers/email.service';
import { sendOTPSMS } from '../../../workers/messenger.service';

const SOURCE = 'RESEND_OTP';
const EVENT = 'Resending_OTP';
// services/auth_mod_sys_users/resendOTP/index.ts — only the changed parts
interface Payload {
  userId: string; // only this comes from the client/JWT now
  network: NetworkContext;
}

export async function Resend_OTP(
  params: Payload
): Promise<Service_Error_Handler | Service_Success_Handler> {
  const started_at = Date.now();
  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'SYSTEM' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };
  try {
    const { userId, network } = params;
    if (!userId || !network) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'All required fields must be provided.',
        error_code: 'MISSING_REQUIRED_FIELDS',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    const user = await AppDataSource.getRepository(User).findOneBy({ id: userId });
    if (!user) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'User not found.',
        error_code: 'USER_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    const otp = await generateOTP(userId);

    sendOTPEmail({ to: user.email, username: user.username, otp }).catch((err) =>
      Log.debug(SOURCE, `OTP ${otp} email failed: ${err}`, EVENT)
    );
    sendOTPSMS(user.telephone, otp).catch((err) =>
      Log.debug(SOURCE, `OTP SMS failed: ${err}`, EVENT)
    );

    return await OPS_Success({
      ...ops_base,
      actor_id: user.id,
      actor_type: 'VOTER',
      status: 'COMPLETED',
      message: 'A new verification code has been sent.',
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
