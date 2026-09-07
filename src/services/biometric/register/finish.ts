// Tier 1.3 — WebAuthn registration finish.
// Verifies the client's attestation response against the stored challenge and,
// on success, persists the new BiometricCredential row.
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

const WEBAUTHN_ORIGIN = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:5173';
const RP_ID = process.env.RP_ID ?? 'localhost';
import { Service_Success_Handler, Service_Error_Handler } from '../../../types/Response_handler';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { OtpCode } from '../../../entities/OtpCode';
import { BiometricCredential } from '../../../entities/BiometricCredential';
import { OPS_Error, OPS_Success } from '../../../lib/ops/ops.factory';

const EVENT = 'BIOMETRIC_REGISTRATION_FINISH';
const SOURCE = 'BiometricRegistrationFinish_Operation';

export async function BiometricRegistrationFinish_Operation(params: {
  userId: string;
  response: RegistrationResponseJSON;
  deviceName?: string;
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
    auth: { factors_used: ['BIOMETRIC'], confidence: 1.0, mfa_verified: true },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  try {
    // Retrieve + consume the challenge issued by start().
    const challengeRepo = AppDataSource.getRepository(OtpCode);
    const pending = await challengeRepo.findOne({
      where: { user_identifier: `bio_reg_${params.userId}` },
    });
    if (!pending) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'No pending registration challenge. Please start again.',
        error_code: 'NO_PENDING_CHALLENGE',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }
    await challengeRepo.delete({ id: pending.id });
    if (Date.now() > pending.expires_at.getTime()) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Registration challenge expired. Please start again.',
        error_code: 'CHALLENGE_EXPIRED',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: params.response,
        expectedChallenge: pending.code_hash,
        expectedOrigin: WEBAUTHN_ORIGIN,
        expectedRPID: RP_ID,
      });
    } catch {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Biometric registration verification failed.',
        error_code: 'VERIFICATION_FAILED',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

        if (!verification || !verification.registrationInfo) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Biometric registration verification failed.',
        error_code: 'VERIFICATION_FAILED',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    const { credential } = verification.registrationInfo;

    // Persist the credential.
    const credRepo = AppDataSource.getRepository(BiometricCredential);
    const newCredential = credRepo.create({
      user_id: params.userId,
      credential_id: credential.id,
      public_key: bufferToBase64url(credential.publicKey),
      sign_count: credential.counter,
      device_name: params.deviceName ?? null,
      transports: params.response.response?.transports ?? [],
    });
    await credRepo.save(newCredential);

    Log.info(SOURCE, 'Biometric credential registered', EVENT);

    return await OPS_Success({
      ...ops_base,
      actor_id: params.userId,
      actor_type: 'VOTER',
      status: 'COMPLETED',
      message: 'Biometric credential registered.',
      data: {
        credential_id: newCredential.id,
        device_name: newCredential.device_name,
      },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to finish biometric registration.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${ops_base.started_at}`,
    });
  }
}

function bufferToBase64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64url');
}
