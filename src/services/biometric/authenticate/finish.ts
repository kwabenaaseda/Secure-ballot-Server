// Tier 1.3 — WebAuthn authentication (step-up) finish.
// Verifies the client's assertion against the stored challenge and the enrolled
// credential's public key, then issues a short-lived step-up token.
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { Service_Success_Handler, Service_Error_Handler } from '../../../types/Response_handler';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { BiometricCredential } from '../../../entities/BiometricCredential';
import { OtpCode } from '../../../entities/OtpCode';
import { OPS_Error, OPS_Success } from '../../../lib/ops/ops.factory';
import { GenerateToken } from '../../../utils/auth';

const EVENT = 'BIOMETRIC_AUTHENTICATION_FINISH';
const SOURCE = 'BiometricAuthenticationFinish_Operation';

const WEBAUTHN_ORIGIN = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:5173';
const RP_ID = process.env.RP_ID ?? 'localhost';

export async function BiometricAuthenticationFinish_Operation(params: {
  userId: string;
  response: AuthenticationResponseJSON;
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
    auth: { factors_used: ['BIOMETRIC'], confidence: 1.0, mfa_verified: true },
    classification: 'SEALED' as const,
    integrity_class: 'IMMUTABLE' as const,
  };

  try {
    // Locate the enrolled credential by ID.
    const credRepo = AppDataSource.getRepository(BiometricCredential);
    const credential = await credRepo.findOne({
      where: { credential_id: params.response.id },
    });

    if (!credential || credential.user_id !== params.userId) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Unknown or unowned credential.',
        error_code: 'UNKNOWN_CREDENTIAL',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    // Retrieve + consume the challenge.
    const challengeRepo = AppDataSource.getRepository(OtpCode);
    const key = `bio_auth_${params.userId}_${params.purpose}`;
    const pending = await challengeRepo.findOne({ where: { user_identifier: key } });
    if (!pending) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'No pending authentication challenge.',
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
        message: 'Authentication challenge expired.',
        error_code: 'CHALLENGE_EXPIRED',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: params.response,
        expectedChallenge: pending.code_hash,
        expectedOrigin: WEBAUTHN_ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: credential.credential_id,
          publicKey: Buffer.from(credential.public_key, 'base64url'),
          counter: credential.sign_count,
          transports: credential.transports as any,
        },
      });
    } catch {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Biometric authentication verification failed.',
        error_code: 'VERIFICATION_FAILED',
        error_category: 'AUTH',
        retryable: true,
      });
    }

    if (!verification || !verification.verified) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Biometric authentication verification failed.',
        error_code: 'VERIFICATION_FAILED',
        error_category: 'AUTH',
        retryable: true,
      });
    }

    // Advance the replay counter.
    await credRepo.update(credential.id, { sign_count: verification.authenticationInfo.newCounter });

    // Issue a short-lived step-up token for the requested purpose.
    const stepUpToken = await GenerateToken({
      id: params.userId,
      username: '',
      email: '',
      network: params.network,
      verification: 'verified',
      user_status: 'green',
      range: 'SELF_ACCOUNT_ACCESS',
      data: { step_up_purpose: params.purpose, step_up_resource: params.resourceId },
    });

    Log.info(SOURCE, `Step-up token issued for ${params.purpose}`, EVENT);

    return await OPS_Success({
      ...ops_base,
      actor_id: params.userId,
      actor_type: 'VOTER',
      status: 'COMPLETED',
      message: 'Biometric authentication verified.',
      data: { step_up_token: stepUpToken, purpose: params.purpose },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to finish biometric authentication.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${ops_base.started_at}`,
    });
  }
}
