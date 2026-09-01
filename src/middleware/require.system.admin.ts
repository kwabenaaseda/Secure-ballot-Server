import { Request, Response, NextFunction } from 'express';

// Runs AFTER AuthMiddleware. AuthMiddleware only proves "this token is
// valid and unexpired" — it says nothing about WHO the token belongs to.
// This is the second gate: it proves the token was minted for a
// SystemAdmin, not a regular User. Two different entities, two different
// tables — a User token can never satisfy this check, by construction.
export function RequireSystemAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.token.token_range !== 'SYSTEM_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. System admin access required.',
    });
  }
  next();
}

// Extra tier on top: only super_admin can onboard other admins.
// We stash level on token_data at login time (see login service).
export function RequireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (
    !req.user ||
    req.user.token.token_range !== 'SYSTEM_ADMIN' ||
    req.user.token.token_data !== 'super_admin'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Super admin access required.',
    });
  }
  next();
}
