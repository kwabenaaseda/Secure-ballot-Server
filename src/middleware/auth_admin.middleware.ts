import { Request, Response, NextFunction } from 'express';
import { VerifyToken } from '../utils/auth';
import { Log } from '../utils/Logger';
import { AppDataSource } from '../config/database';
import { TokenBlacklist } from '../entities/token_blacklist';

// Extend Express Request to carry admin data
declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        email: string;
        username: string;
        level: 'admin' | 'super_admin';
        token: {
          token: string;
          token_range: string;
          token_jti?: string;
          token_exp?: number;
        };
      };
    }
  }
}

export async function AuthAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // ── STEP 1: GET TOKEN FROM HEADER ──────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[AuthAdminMiddleware] No auth header or invalid format');
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    console.log('[AuthAdminMiddleware] Token received:', token.substring(0, 20) + '...');

    // ── STEP 2: VERIFY TOKEN ───────────────────────────
    const decoded = (await VerifyToken(token)) as any;
    console.log('[AuthAdminMiddleware] Token decoded, range:', decoded.range, 'sub:', decoded.sub);

    // ── STEP 2.5: CHECKSUM FAIL FAST ───────────────────────────
    if (!token || !decoded.range || !decoded.sub) {
      console.log('[AuthAdminMiddleware] Malformed token');
      return res.status(401).json({
        success: false,
        message: 'Malformed token. Please retry action after 2 minutes',
      });
    }

    // ── STEP 2.6: REVOCATION CHECK ─────────────────────────────
    if (decoded.jti) {
      const revoked = await AppDataSource.getRepository(TokenBlacklist).findOneBy({
        jti: decoded.jti,
      });
      if (revoked) {
        console.log('[AuthAdminMiddleware] Token revoked');
        return res.status(401).json({
          success: false,
          message: 'Session revoked. Please sign in again.',
        });
      }
    }

    // ── STEP 2.7: VERIFY THIS IS AN ADMIN TOKEN ───────────────────────────
    // Admin tokens have range 'SYSTEM_ADMIN' or 'SYSTEM_ADMIN[PART]'
    const range = decoded.range as string;
    if (!range.startsWith('SYSTEM_ADMIN')) {
      console.log('[AuthAdminMiddleware] Not an admin token, range:', range);
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Admin access required.',
      });
    }

    // ── STEP 3: ATTACH ADMIN TO REQUEST ─────────────────
    req.admin = {
      id: decoded.sub,
      email: decoded.email,
      username: decoded.username,
      level: decoded.level || 'admin',
      token: {
        token: token,
        token_range: decoded.range,
        token_jti: decoded.jti ?? undefined,
        token_exp: typeof decoded.exp === 'number' ? decoded.exp : undefined,
      },
    };

    console.log('[AuthAdminMiddleware] Admin authenticated:', req.admin.email);
    return next();
  } catch (error) {
    console.log('[AuthAdminMiddleware] Error:', String(error));
    Log.warn('AuthAdminMiddleware', String(error), 'AUTH');
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Invalid or expired token.',
    });
  }
}
