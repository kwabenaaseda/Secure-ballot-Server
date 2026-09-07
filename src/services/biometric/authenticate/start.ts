// Tier 1.3 — WebAuthn authentication (step-up) start.
// Issues an authentication challenge scoped to the user's enrolled credentials.
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { Service_Success_Handler, Service_Error_Handler } from '../../../types/Response_handler';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { BiometricCredential } from '../../../entities/BiometricCredential';
import { OtpCode } from '../../../entities/OtpCode';
import { OPS_Error, OPS_Success } from '../../../lib/ops/ops.factory';

const EVENT = 'BIOMETRIC_AUTHENTICATION_START';
const SOURCE = 'BiometricAuthenticationStart_Operation';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export async function BiometricAuthenticationStart_Operation(params: {
  userId: string;
  purpose: 'VOTE' | 'ACCOUNT_MUTATE';
  resourceId?: string;
  network: import('../../../lib/ops/ops.types').NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();

  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'SYSTEM' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['PASSWORD', 'OTP'], confidence: 1.0, mfa_verified: true },
    classification: 'SEALED' as const,
    integrity_class: 'IMMUTABLE' as const,
  };

  try {
    const credRepo = AppDataSource.getRepository(BiometricCredential);
    const credentials = await credRepo.find({ where: { user_id: params.userId } });

    if (credentials.length === 0) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'No biometric credentials enrolled.',
        error_code: 'NO_CREDENTIALS',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const options = await generateAuthenticationOptions({
      rpID: process.env.RP_ID ?? 'localhost',
      allowCredentials: credentials.map((c) => ({
        id: c.credential_id,
        transports: c.transports as any,
      })),
      userVerification: 'preferred',
    });

    // Store challenge keyed by purpose so finish() can bind it to the action.
    const store = AppDataSource.getRepository(OtpCode);
    const key = `bio_auth_${params.userId}_${params.purpose}`;
    await store.delete({ user_identifier: key });
    await store.save(
      store.create({
        user_identifier: key,
        code_hash: options.challenge,
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS),
      }),
    );

    Log.info(SOURCE, `Authentication challenge issued for ${params.purpose}`, EVENT);

    return await OPS_Success({
      ...ops_base,
      actor_id: params.userId,
      actor_type: 'VOTER',
      status: 'COMPLETED',
      message: 'Authentication challenge issued.',
      data: { options, purpose: params.purpose, resource_id: params.resourceId },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to start biometric authentication.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${ops_base.started_at}`,
    });
  }
}
