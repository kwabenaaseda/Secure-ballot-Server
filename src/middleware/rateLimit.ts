// src/middleware/rateLimit.ts
// Tier 0.3 — real throttling for auth-adjacent surfaces. This is the
// enforcement layer behind the threat concepts the audit log already models
// (RATE_LIMIT_EXCEEDED, CONCURRENT_SESSION). Two tiers:
//
//   authLimiter — strict, per-IP, applied to every credential-bearing route
//                 (signup, login, verify-otp, resend, recovery, admin login).
//   apiLimiter  — coarse global backstop applied to all of /api/vx in app.ts.
//
// Both fail with the standard { success, message } envelope so the client's
// ApiError handling treats a 429 like any other rejection.

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

function tooMany(res: Response, message: string) {
  res.status(429).json({ success: false, message });
}

/** Strict: credential endpoints. Brute-force budget: 10 attempts / 15 min / IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    tooMany(res, 'Too many attempts. Please wait a few minutes and try again.'),
});

/** Coarse backstop for everything under /api/vx. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    tooMany(res, 'Too many requests. Please slow down and try again shortly.'),
});