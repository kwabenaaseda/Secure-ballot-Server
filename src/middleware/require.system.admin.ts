import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { SystemAdmin } from '../entities/SystemAdmin';
import { Log } from '../utils/Logger';

// ── Admin authorization cache ────────────────────────────────────────────────
// Runs AFTER AuthMiddleware, which has already verified the JWT and resolved
// the caller's role. The previous implementation re-queried the database here
// (Operations_Manager → User profile + SystemAdmin lookup, then another
// SystemAdmin lookup) on EVERY admin request — 2-3 serial round-trips per call.
//
// This caches SystemAdmin records in memory with a short TTL so that
// suspension / level changes still take effect quickly (within ADMIN_CACHE_TTL_MS)
// while each authorized admin request costs at most one indexed lookup.
const ADMIN_CACHE_TTL_MS = 30 * 1000; // 30s — balances freshness vs. DB load

const adminCache = new Map<
  string,
  { record: SystemAdmin | null; expiresAt: number }
>();

async function findCachedAdmin(email: string): Promise<SystemAdmin | null> {
  const now = Date.now();
  const hit = adminCache.get(email);
  if (hit && hit.expiresAt > now) {
    return hit.record;
  }

  const repo = AppDataSource.getRepository(SystemAdmin);
  let record: SystemAdmin | null = null;
  try {
    record = await repo.findOne({ where: { email } });
  } catch (err) {
    Log.warn('AdminCache', String(err), 'AUTH');
    // fail closed on cache-miss query errors by returning null
  }

  // Cache both hits AND misses (negative caching) to avoid hammering the DB
  // with lookups for non-admin accounts attempting admin routes.
  adminCache.set(email, { record, expiresAt: now + ADMIN_CACHE_TTL_MS });
  return record;
}

export async function RequireSystemAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(403).json({ success: false, message: 'Forbidden. System admin access required.' });
    }

    const admin = await findCachedAdmin(req.user.email);
    if (!admin || admin.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Forbidden. System admin access required.' });
    }

    return next();
  } catch (err) {
    Log.warn('RequireSystemAdmin', String(err), 'AUTH');
    return res.status(500).json({ success: false, message: 'Internal error validating admin access.' });
  }
}

export async function RequireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(403).json({ success: false, message: 'Forbidden. Super admin access required.' });
    }

    const admin = await findCachedAdmin(req.user.email);
    if (!admin || admin.status !== 'active' || admin.level !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Super admin access required.' });
    }

    return next();
  } catch (err) {
    Log.warn('RequireSuperAdmin', String(err), 'AUTH');
    return res.status(500).json({ success: false, message: 'Internal error validating admin access.' });
  }
}
