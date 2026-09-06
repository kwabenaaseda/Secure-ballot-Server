// src/services/auth_mod_sys_users/account_recovery/reset_password/index.ts
// Complete password reset after OTP verification.
// Requires the short-lived token issued by verify-recovery-otp.

import { Service_Success_Handler, Service_Error_Handler } from '../../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../../lib/ops/ops.factory';
import { Log } from '../../../../utils/Logger';
import { AppDataSource } from '../../../../config/database';
import { User } from '../../../../entities/User';
import { Hash_Password } from '../../../../utils/auth';
import { NetworkContext } from '../../../../lib/ops/ops.types';

const EVENT = 'RESET_PASSWORD';
const SOURCE = 'ResetPassword_Operation';

export async function ResetPassword_Operation(params: {
  userId: string;
  new_password: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'SYSTEM' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['OTP'], confidence: 1.0, mfa_verified: true },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  try {
    const { userId, new_password } = params;

    if (!userId || !new_password) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'All required fields must be provided.',
        error_code: 'MISSING_REQUIRED_FIELDS',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOneBy({ id: userId });

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

    // Hash the new password
    const password_hash = await Hash_Password(new_password);
    await userRepository.update(userId, { password_hash });

    Log.info(SOURCE, 'Password reset successful', EVENT);

    return await OPS_Success({
      ...ops_base,
      actor_id: user.id,
      actor_type: 'VOTER',
      status: 'COMPLETED',
      message: 'Password reset successful. You may now log in with your new password.',
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), EVENT);

    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: `An unexpected error occurred during ${EVENT}.`,
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${ops_base.started_at}`,
    });
  }
}
