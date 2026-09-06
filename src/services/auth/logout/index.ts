// src/services/auth/logout/index.ts
// POST /auth/user/logout and POST /auth/admin/logout (Tier 0.4).
// Revokes the presented token by inserting its jti into token_blacklist with
// the token's own natural expiry. AuthMiddleware then rejects the token for
// the remainder of its lifetime. Insert-only: no update path exists, so the
// table stays append-only like every other security surface here.

import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { TokenBlacklist } from '../../../entities/token_blacklist';
import { NetworkContext } from '../../../lib/ops/ops.types';

const SOURCE = 'Logout_Operation';

export async function Logout_Operation(payload: {
  jti: string;
  expiresAt: Date;
  userId: string | null; // null for SYSTEM_ADMIN tokens (no users-table row)
  actorType: 'VOTER' | 'ORG_ADMIN' | 'SYSTEM_ADMIN';
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = {
    event: 'LOGOUT',
    source: SOURCE,
    actor_type: payload.actorType,
    actor_id: payload.userId ?? 'system-admin',
    started_at,
    network: payload.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  try {
    const repo = AppDataSource.getRepository(TokenBlacklist);

    // Idempotent: logging out twice with the same token is harmless.
    const existing = await repo.findOneBy({ jti: payload.jti });
    if (!existing) {
      await repo.insert(
        repo.create({
          jti: payload.jti,
          user: payload.userId ? ({ id: payload.userId } as any) : null,
          blacklisted_at: new Date(),
          expires_at: payload.expiresAt,
        })
      );
    }

    Log.info(SOURCE, 'Token revoked via blacklist', 'LOGOUT');

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Signed out. This session token is now revoked.',
      data: { revoked: true },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'LOGOUT');
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to revoke session.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 3000,
      stack_ref: `LOGOUT_${started_at}`,
    });
  }
}
