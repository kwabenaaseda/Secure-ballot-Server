import { Request, Response, NextFunction } from 'express';
import { VerifyToken } from '../utils/auth';
import { Log } from '../utils/Logger';
import { success } from 'zod/v4';

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
      },
    };

    next();
  } catch (error) {
    Log.warn('AuthMiddleware', String(error), 'AUTH');
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Invalid or expired token.',
    });
  }
}
