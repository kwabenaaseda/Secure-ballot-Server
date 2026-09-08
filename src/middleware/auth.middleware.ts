import { Request, Response, NextFunction } from 'express';
import { VerifyToken } from '../utils/auth';
import { Log } from '../utils/Logger';
import { AppDataSource } from '../config/database';
import Operations_Manager from '../utils/ops.manager';
import { TokenBlacklist } from '../entities/token_blacklist';

// Extend Express Request to carry user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
        token: {
          token: string;
          token_range: string;
          token_verification: string;
          token_user_status: string;
          token_data?: string;
          token_jti?: string; // JWT ID — present on tokens minted after revocation support
          token_exp?: number; // unix seconds — used to blacklist until natural expiry
        };
      };
    }
  }
}

export async function AuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // ── STEP 1: GET TOKEN FROM HEADER ──────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    // ── STEP 2: VERIFY TOKEN ───────────────────────────
    const decoded = (await VerifyToken(token)) as any;

    // ── STEP 2.5: CHECKSUM FAIL FAST ───────────────────────────
    if (!token || !decoded.range || !decoded.verification || !decoded.user_status || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: 'Malformed token. Please retry action after 2 minutes',
      });
    }

    // ── STEP 2.6: REVOCATION CHECK ─────────────────────────────
    // Logout inserts the token's jti into token_blacklist; a revoked token is
    // rejected here for the rest of its natural lifetime. Tokens minted before
    // revocation support carry no jti and pass (documented backward compat).
    // One indexed primary-key lookup per request.
    if (decoded.jti) {
      const revoked = await AppDataSource.getRepository(TokenBlacklist).findOneBy({
        jti: decoded.jti,
      });
      if (revoked) {
        return res.status(401).json({
          success: false,
          message: 'Session revoked. Please sign in again.',
        });
      }
    }

    // ── STEP 3: ATTACH USER TO REQUEST ─────────────────
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      username: decoded.username,
      token: {
        token: token,
        token_range: decoded.range,
        token_verification: decoded.verification,
        token_user_status: decoded.user_status,
        token_data: decoded.data ? decoded.data : false,
        token_jti: decoded.jti ?? undefined,
        token_exp: typeof decoded.exp === 'number' ? decoded.exp : undefined,
      },
    };

    // ── STEP 4: RE-RESOLVE ROLE TO HONOR LIVE CHANGES ─────────
    // Resolve the caller's current role from the DB and attach it to the
    // request as `resolved_role`. Do NOT fail requests simply because the
    // token's baked-in range differs from the DB-resolved role: services
    // should consult `resolved_role` (or call Operations_Manager) to make
    // fine-grained decisions. We only reject when the profile cannot be
    // resolved at all (e.g. user deleted).
    try {
      // Domestic resolution (default). Attach as `resolved_role`.
      const opsDomestic = await Operations_Manager({ user_id: decoded.sub, location: 'domestic' });
      if (opsDomestic === false) {
        return res.status(401).json({ success: false, message: 'Unable to resolve account profile.' });
      }
      (req.user as any).resolved_role = opsDomestic.role;
      if (opsDomestic.role !== decoded.range) {
        Log.info('AuthMiddleware', `Token role differs from DB role: token=${decoded.range} db=${opsDomestic.role}`, 'AUTH');
      }

      // If the route includes an orgId param, also resolve the org-scoped role and attach
      const orgId = (req.params as any)?.orgId;
      if (orgId) {
        try {
          const opsOrg = await Operations_Manager({ user_id: decoded.sub, org_id: orgId, location: 'organization' });
          if (opsOrg !== false) {
            (req.user as any).resolved_org_role = opsOrg.role;
            if (opsOrg.role !== (req.user as any).resolved_role) {
              Log.info('AuthMiddleware', `Org role differs from account role: account=${(req.user as any).resolved_role} org=${opsOrg.role}`, 'AUTH');
            }
          }
        } catch (err) {
          Log.warn('AuthMiddleware', `Org role resolution failed: ${String(err)}`, 'AUTH');
          // Do not reject the request here; controllers can decide to require org membership.
        }
      }
    } catch (err) {
      Log.warn('AuthMiddleware', String(err), 'AUTH');
      return res.status(401).json({ success: false, message: 'Unauthorized. Error resolving access profile.' });
    }

    return next();
  } catch (error) {
    Log.warn('AuthMiddleware', String(error), 'AUTH');
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Invalid or expired token.',
    });
  }
}
