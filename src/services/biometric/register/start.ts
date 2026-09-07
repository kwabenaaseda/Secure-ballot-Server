// Tier 1.3 — WebAuthn registration start.
// Generates registration options (challenge + rp/user info + excluded credentials)
// and stores the pending challenge for the finish step to verify against.
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { Service_Success_Handler, Service_Error_Handler } from '../../../types/Response_handler';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { User } from '../../../entities/User';
import { BiometricCredential } from '../../../entities/BiometricCredential';
import { OtpCode } from '../../../entities/OtpCode';
import { OPS_Error, OPS_Success } from '../../../lib/ops/ops.factory';

const EVENT = 'BIOMETRIC_REGISTRATION_START';
const SOURCE = 'BiometricRegistrationStart_Operation';

// Replay window for the registration challenge (matches OTP semantics).
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export async function BiometricRegistrationStart_Operation(params: {
  userId: string;
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
    auth: { factors_used: ['PASSWORD'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: params.userId });
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

    // Already-enrolled credentials are excluded so the user can't double-register
    // the same device.
    const credRepo = AppDataSource.getRepository(BiometricCredential);
    const existing = await credRepo.find({ where: { user_id: params.userId } });

    const options = await generateRegistrationOptions({
      rpName: 'SecureBallot',
      rpID: process.env.RP_ID ?? 'localhost',
      userID: Buffer.from(user.id),
      userName: user.username,
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credential_id,
        transports: c.transports as any,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Persist the challenge so finish() can verify the response originated here.
    const store = AppDataSource.getRepository(OtpCode);
    await store.delete({ user_identifier: `bio_reg_${params.userId}` });
    await store.save(
      store.create({
        user_identifier: `bio_reg_${params.userId}`,
        code_hash: options.challenge,
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS),
      }),
    );

    Log.info(SOURCE, 'Registration challenge issued', EVENT);

    return await OPS_Success({
      ...ops_base,
      actor_id: user.id,
      actor_type: 'VOTER',
      status: 'COMPLETED',
      message: 'Registration challenge issued.',
      data: { options },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to start biometric registration.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${ops_base.started_at}`,
    });
  }
}
