// src/services/auth/refresh/index.ts
// POST /auth/user/refresh (Tier 3). Refresh tokens were issued by every
// login/signup but had no consumer — an issued-but-unusable credential. This
// endpoint makes the capability real:
//   1. Verify the refresh JWT (sub + jti only).
//   2. Reject revoked jtis (blacklist).
//   3. Confirm the user still exists and is not flagged (red).
//   4. ROTATE: blacklist the presented refresh token, issue a fresh pair.

import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { User } from '../../../entities/User';
import { TokenBlacklist } from '../../../entities/token_blacklist';
import { VerifyToken, GenerateToken, Generate_Refresh_Token } from '../../../utils/auth';
import { auth_generate_token_payload } from '../../../utils/types';
import Operations_Manager from '../../../utils/ops.manager';
import { NetworkContext } from '../../../lib/ops/ops.types';

const SOURCE = 'RefreshTokens_Operation';

export async function RefreshTokens_Operation(payload: {
  refresh_token: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = {
    event: 'TOKEN_REFRESH',
    source: SOURCE,
    actor_type: 'SYSTEM' as const,
    actor_id: 'unauthenticated-refresh',
    started_at,
    network: payload.network,
    auth: { factors_used: ['REFRESH_TOKEN'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  try {
    if (!payload.refresh_token) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'refresh_token is required.',
        error_code: 'MISSING_REQUIRED_FIELDS',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    // 1) Verify signature + expiry.
    const decoded = (await VerifyToken(payload.refresh_token)) as any;
    if (!decoded?.sub) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Invalid refresh token.',
        error_code: 'INVALID_REFRESH_TOKEN',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    // 2) Revocation check (rotated or logged-out refresh tokens land here).
    if (decoded.jti) {
      const revoked = await AppDataSource.getRepository(TokenBlacklist).findOneBy({
        jti: decoded.jti,
      });
      if (revoked) {
        return await OPS_Error({
          ...ops_base,
          status: 'OPERATION_FAILURE',
          message: 'Refresh token has been revoked.',
          error_code: 'REFRESH_TOKEN_REVOKED',
          error_category: 'AUTH',
          retryable: false,
        });
      }
    }

    // 3) The account must still exist and remain in good standing.
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: decoded.sub });
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
    if (user.user_status === 'red') {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'This account no longer has access.',
        error_code: 'NO_ACCESS',
        error_category: 'AUTH',
        retryable: false,
      });
    }

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

    // 4) Rotate — blacklist the presented refresh token, then issue a new pair.
    if (decoded.jti && typeof decoded.exp === 'number') {
      await AppDataSource.getRepository(TokenBlacklist).insert(
        AppDataSource.getRepository(TokenBlacklist).create({
          jti: decoded.jti,
          user: { id: user.id } as any,
          blacklisted_at: new Date(),
          expires_at: new Date(decoded.exp * 1000),
        })
      );
    }

    const token_payload: auth_generate_token_payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      network: payload.network,
      verification: user.verification_status,
      user_status: user.user_status,
      range: ops.role,
    };
    const token = await GenerateToken(token_payload);
    const refresh_token = await Generate_Refresh_Token({ id: user.id });

    Log.info(SOURCE, 'Token pair refreshed and rotated', 'TOKEN_REFRESH');

    return await OPS_Success({
      ...ops_base,
      actor_id: user.id,
      actor_type: 'VOTER',
      status: 'COMPLETED',
      message: 'Session refreshed.',
      data: { token, refresh_token },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'TOKEN_REFRESH');
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: 'Invalid or expired refresh token.',
      error_code: 'INVALID_REFRESH_TOKEN',
      error_category: 'AUTH',
      retryable: false,
    });
  }
}
