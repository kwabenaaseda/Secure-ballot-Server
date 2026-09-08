import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { SystemAdmin } from '../entities/SystemAdmin';
import { Log } from '../utils/Logger';
import Operations_Manager from '../utils/ops.manager';

// Runs AFTER AuthMiddleware. This middleware verifies the admin record
// directly from the database (not the JWT) so that admin suspensions or
// level changes take effect immediately.
export async function RequireSystemAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(403).json({ success: false, message: 'Forbidden. System admin access required.' });
    }

    // Prefer resolving the caller's role via Operations_Manager so role
    // decisions are centralized. If Operations_Manager returns a role of
    // SYSTEM_ADMIN we allow. Otherwise fall back to the SystemAdmin table
    // lookup to preserve compatibility for admin tokens that are not backed
    // by a User row.
    try {
      const ops = await Operations_Manager({ user_id: req.user.id, location: 'domestic' });
      if (ops !== false && ops.role === 'SYSTEM_ADMIN') {
        return next();
      }
    } catch (err) {
      Log.warn('RequireSystemAdmin', `Operations_Manager error: ${String(err)}`, 'AUTH');
      // continue to fallback check
    }

    const adminRepo = AppDataSource.getRepository(SystemAdmin);
    const admin = await adminRepo.findOne({ where: { email: req.user.email } });
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

    // First try Operations_Manager to see if the resolved role is SYSTEM_ADMIN
    // and if token_data indicates super_admin (legacy tokens). If that fails
    // or is inconclusive, fall back to the SystemAdmin table check.
    try {
      const ops = await Operations_Manager({ user_id: req.user.id, location: 'domestic' });
      if (ops !== false && ops.role === 'SYSTEM_ADMIN') {
        // If the token stashed role data marks this as super_admin, accept it.
        if ((req.user as any).token?.token_data === 'super_admin') return next();
        // Otherwise fallthrough to DB check for authoritative level.
      }
    } catch (err) {
      Log.warn('RequireSuperAdmin', `Operations_Manager error: ${String(err)}`, 'AUTH');
      // continue to fallback check
    }

    const adminRepo = AppDataSource.getRepository(SystemAdmin);
    const admin = await adminRepo.findOne({ where: { email: req.user.email } });
    if (!admin || admin.status !== 'active' || admin.level !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Super admin access required.' });
    }

    return next();
  } catch (err) {
    Log.warn('RequireSuperAdmin', String(err), 'AUTH');
    return res.status(500).json({ success: false, message: 'Internal error validating admin access.' });
  }
}
