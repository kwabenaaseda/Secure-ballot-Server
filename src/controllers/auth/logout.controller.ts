// src/controllers/auth/logout.controller.ts
// POST /auth/user/logout and POST /auth/admin/logout (Tier 0.4).
// Both routes pass through AuthMiddleware (which attaches req.user + the decoded
// token claims), then NetworkContextMiddleware. This controller reads the JWT's
// jti + exp and hands them to Logout_Operation, which writes the token to the
// append-only token_blacklist so AuthMiddleware rejects it for its remaining
// lifetime. Works for both user ("VOTER"/"ORG_ADMIN") and system-admin tokens.

import { Request, Response } from 'express';
import { Logout_Operation } from '../../services/auth/logout';

export async function Logout_Controller(req: Request, res: Response) {
  // req.user is guaranteed here: both logout routes mount AuthMiddleware first.
  const userId = req.user?.id;
  const jti = req.user?.token.token_jti;
  const exp = req.user?.token.token_exp;
  const range = req.user?.token.token_range;
  const network = req.networkContext;

  if (!network || !jti || exp == null) {
    // Missing jti/exp = a legacy token minted before revocation support, or a
    // missing network context (both middleware should have guaranteed it).
    return res.status(400).json({
      success: false,
      message:
        'This session token cannot be revoked. Please discard it locally and sign in again.',
    });
  }

  // System admins live in SystemAdmin (not User), so the blacklist row for them
  // must leave the user FK null. The actor type is derived from the token's
  // range claim (admin login issues range: 'SYSTEM_ADMIN').
  const actorType =
    range === 'SYSTEM_ADMIN'
      ? ('SYSTEM_ADMIN' as const)
      : range === 'ORG_ADMIN'
        ? ('ORG_ADMIN' as const)
        : ('VOTER' as const);

  const result = await Logout_Operation({
    jti,
    expiresAt: new Date(exp * 1000),
    userId: actorType === 'SYSTEM_ADMIN' ? null : userId ?? null,
    actorType,
    network,
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}