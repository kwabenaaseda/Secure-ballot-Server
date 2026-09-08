// Tier 1.3 — WebAuthn biometric LOGIN finish (pre-auth).
// Verifies the client's assertion against the stored challenge and the enrolled
// credential's public key. On success, promotes the user's verification_status
// to 'verified' (WebAuthn is a stronger proof than OTP), re-resolves the role
// via Operations_Manager, and issues a FULL session token + refresh token —
// bypassing the PART + OTP ladder entirely.
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { Service_Success_Handler, Service_Error_Handler } from '../../../types/Response_handler';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { BiometricCredential } from '../../../entities/BiometricCredential';
import { OtpCode } from '../../../entities/OtpCode';
import { User } from '../../../entities/User';
import { OPS_Error, OPS_Success } from '../../../lib/ops/ops.factory';
import { NetworkContext } from '../../../lib/ops/ops.types';
import { GenerateToken, Generate_Refresh_Token } from '../../../utils/auth';
import { auth_generate_token_payload } from '../../../utils/types';
import Operations_Manager from '../../../utils/ops.manager';

const EVENT = 'BIOMETRIC_LOGIN_FINISH';
const SOURCE = 'BiometricLoginFinish_Operation';

const WEBAUTHN_ORIGIN = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:5173';
const RP_ID = process.env.RP_ID ?? 'localhost';

export async function BiometricLoginFinish_Operation(params: {
  userId?: string;
  response: AuthenticationResponseJSON;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();

  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'SYSTEM' as const, // pre-auth — no actor identity yet
    actor_id: params.userId ?? 'discoverable', // hashed inside OPS factory
    started_at,
    network: params.network,
    auth: {
      factors_used: ['BIOMETRIC'], // verified upon successful assertion
      confidence: 1.0,
      mfa_verified: true, // WebAuthn = possession + inherence → MFA
    },
    classification: 'SEALED' as const,
    integrity_class: 'IMMUTABLE' as const,
  };

  try {
    // ── STEP 1: LOCATE THE ENROLLED CREDENTIAL ──────────────
    const credRepo = AppDataSource.getRepository(BiometricCredential);
    const credential = await credRepo.findOne({
      where: { credential_id: params.response.id },
    });

    if (!credential) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Unknown credential.',
        error_code: 'UNKNOWN_CREDENTIAL',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    // For discoverable flow, userId comes from the credential lookup
    const userId = params.userId ?? credential.user_id;

    // Verify credential ownership (for non-discoverable flow)
    if (params.userId && credential.user_id !== params.userId) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Unknown or unowned credential.',
        error_code: 'UNKNOWN_CREDENTIAL',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    // ── STEP 2: RETRIEVE + CONSUME THE CHALLENGE ─────────────
    const challengeRepo = AppDataSource.getRepository(OtpCode);
    // Try user-specific challenge first, then discoverable
    const challengeKey = params.userId ? `bio_login_${params.userId}` : `bio_login_discoverable`;
    const pending = await challengeRepo.findOne({ where: { user_identifier: challengeKey } });

    if (!pending) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'No pending login challenge. Please try again.',
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
        message: 'Login challenge expired. Please try again.',
        error_code: 'CHALLENGE_EXPIRED',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    // ── STEP 3: VERIFY THE ASSERTION ──────────────────────────
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
        message: 'Biometric verification failed.',
        error_code: 'VERIFICATION_FAILED',
        error_category: 'AUTH',
        retryable: true,
      });
    }

    if (!verification || !verification.verified) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Biometric verification failed.',
        error_code: 'VERIFICATION_FAILED',
        error_category: 'AUTH',
        retryable: true,
      });
    }

    // ── STEP 4: ADVANCE THE REPLAY COUNTER ───────────────────
    await credRepo.update(credential.id, {
      sign_count: verification.authenticationInfo.newCounter,
    });

    // ── STEP 5: PROMOTE VERIFICATION STATUS ──────────────────
    // WebAuthn is a stronger proof than OTP (cryptographic + biometric).
    // Promote the user to 'verified' so role resolution grants FULL access,
    // mirroring what VerifyAccount_Operation does after OTP success.
    const userRepo = AppDataSource.getRepository(User);
    let user = await userRepo.findOneBy({ id: userId });
    if (!user) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'User not found during biometric login.',
        error_code: 'USER_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    if (user.verification_status !== 'verified') {
      user = await userRepo.save({ ...user, verification_status: 'verified' });
    }

    // ── STEP 6: RE-RESOLVE ROLE + ISSUE FULL TOKEN ───────────
    // Same as Login_Operation: re-resolve from the DB so any role status
    // change (red/yellow/green) is honored at the moment of biometric auth.
    const ops = await Operations_Manager({ user_id: user.id, location: 'domestic' });
    if (ops === false) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Unable to resolve access profile for this account.',
        error_code: 'PROFILE_RESOLUTION_FAILED',
        error_category: 'AUTH',
        retryable: true,
      });
    }

    const token_payload: auth_generate_token_payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      network: params.network,
      verification: user.verification_status,
      user_status: user.user_status,
      range: ops.role,
    };

    const token = await GenerateToken(token_payload);
    const refresh_token = await Generate_Refresh_Token({ id: user.id });

    Log.info(SOURCE, 'Biometric login successful', EVENT);

    return await OPS_Success({
      ...ops_base,
      actor_id: user.id,
      actor_type: 'VOTER',
      status: 'COMPLETED',
      message: 'Biometric login successful.',
      data: {
        token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          verification_status: user.verification_status,
        },
      },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to finish biometric login.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${ops_base.started_at}`,
    });
  }
}
