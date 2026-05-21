import { Request, Response, NextFunction } from 'express';
import { VerifyToken } from '../utils/auth';
import { Log } from '../utils/Logger';

// Extend Express Request to carry user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
      };
    }
  }
}

export async function AuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // ── STEP 1: GET TOKEN FROM HEADER ──────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. No token provided.",
      });
    }

    const token = authHeader.split(' ')[1];

    // ── STEP 2: VERIFY TOKEN ───────────────────────────
    const decoded = await VerifyToken(token) as any;

    // ── STEP 3: ATTACH USER TO REQUEST ─────────────────
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      username: decoded.username,
    };

    next();

  } catch (error) {
    Log.warn("AuthMiddleware", String(error), "AUTH");
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Invalid or expired token.",
    });
  }
}