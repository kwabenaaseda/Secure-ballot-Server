// Tier 1.3 — WebAuthn biometric LOGIN start (pre-auth).
// Generates authentication options (challenge + allowCredentials) for a user
// identified by email/username — no existing session required.
// Mirrors BiometricAuthenticationStart_Operation but works without AuthMiddleware.
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { Service_Success_Handler, Service_Error_Handler } from '../../../types/Response_handler';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { User } from '../../../entities/User';
import { BiometricCredential } from '../../../entities/BiometricCredential';
import { OtpCode } from '../../../entities/OtpCode';
import { OPS_Error, OPS_Success } from '../../../lib/ops/ops.factory';
import { NetworkContext } from '../../../lib/ops/ops.types';

const EVENT = 'BIOMETRIC_LOGIN_START';
const SOURCE = 'BiometricLoginStart_Operation';

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches OTP semantics

export async function BiometricLoginStart_Operation(params: {
  identifier?: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();

  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'SYSTEM' as const, // pre-auth — no actor identity yet
    actor_id: params.identifier ?? 'discoverable', // hashed inside OPS factory
    started_at,
    network: params.network,
    auth: {
      factors_used: ['WEBAUTHN'], // biometric/PIN step happens client-side
      confidence: 1.0,
      mfa_verified: false, // not verified until finish() confirms the assertion
    },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  try {
    const { identifier } = params;

    // ── DISCOVERABLE CREDENTIAL FLOW ─────────────────────────────────
    // If no identifier provided, generate challenge for discoverable credentials.
    // The browser will automatically find the right credential without user input.
    if (!identifier) {
      const options = await generateAuthenticationOptions({
        rpID: process.env.RP_ID ?? 'localhost',
        allowCredentials: [], // Empty array = discoverable credentials
        userVerification: 'preferred',
      });

      // Store challenge with a generic key for discoverable flow
      const store = AppDataSource.getRepository(OtpCode);
      const challengeKey = `bio_login_discoverable`;
      await store.delete({ user_identifier: challengeKey });
      await store.save(
        store.create({
          user_identifier: challengeKey,
          code_hash: options.challenge,
          expires_at: new Date(Date.now() + CHALLENGE_TTL_MS),
        }),
      );

      Log.info(SOURCE, 'Biometric login challenge issued (discoverable)', EVENT);

      return await OPS_Success({
        ...ops_base,
        actor_type: 'VOTER',
        status: 'COMPLETED',
        message: 'Authentication challenge issued.',
        data: { options },
      });
    }

    // ── IDENTIFIER-BASED FLOW ────────────────────────────────────────
    // User provided email/username - look up their enrolled credentials
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: [{ email: identifier }, { username: identifier }],
    });

    if (!user) {
      // Deliberately vague — don't reveal whether the identifier exists.
      // The client treats this as "no passkey enrolled" and falls back
      // to password login.
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'No biometric credentials found for this account.',
        error_code: 'NO_CREDENTIALS',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    // ── STEP 2: CHECK FOR ENROLLED CREDENTIALS ───────────────────────
    const credRepo = AppDataSource.getRepository(BiometricCredential);
    const credentials = await credRepo.find({ where: { user_id: user.id } });

    if (credentials.length === 0) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'No biometric credentials found for this account.',
        error_code: 'NO_CREDENTIALS',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    // ── STEP 3: GENERATE AUTHENTICATION OPTIONS ──────────────────────
    const options = await generateAuthenticationOptions({
      rpID: process.env.RP_ID ?? 'localhost',
      allowCredentials: credentials.map((c) => ({
        id: c.credential_id,
        transports: c.transports as any,
      })),
      userVerification: 'preferred',
    });

    // ── STEP 4: STORE CHALLENGE (replace any stale pending login) ───
    const store = AppDataSource.getRepository(OtpCode);
    const challengeKey = `bio_login_${user.id}`;
    await store.delete({ user_identifier: challengeKey });
    await store.save(
      store.create({
        user_identifier: challengeKey,
        code_hash: options.challenge,
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS),
      }),
    );

    Log.info(SOURCE, 'Biometric login challenge issued', EVENT);

    return await OPS_Success({
      ...ops_base,
      actor_id: user.id,
      actor_type: 'VOTER',
      status: 'COMPLETED',
      message: 'Authentication challenge issued.',
      data: { options, user: { id: user.id, email: user.email, username: user.username } },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to start biometric login.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${ops_base.started_at}`,
    });
  }
}