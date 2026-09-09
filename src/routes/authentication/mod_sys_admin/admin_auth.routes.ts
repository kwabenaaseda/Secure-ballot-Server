import Router from 'express';
import {
  AdminLogin_Controller,
  OnboardAdmin_Controller,
  VerifyAdminOTP_Controller,
  ResendAdminOTP_Controller,
} from '../../../controllers/authentication/admin_auth.controller';
import { AuthMiddleware } from '../../../middleware/auth.middleware';
import { AuthAdminMiddleware } from '../../../middleware/auth_admin.middleware';
import { NetworkContextMiddleware } from '../../../middleware/networkContext';
import { RequireSuperAdmin } from '../../../middleware/require.system.admin';
import { authLimiter } from '../../../middleware/rateLimit';
import { Logout_Controller } from '../../../controllers/auth/logout.controller';

const Admin_auth_routes = Router();

/**
 * @swagger
 * tags:
 *   - name: Auth - Admin
 *     description: System admin authentication endpoints
 */

/**
 * @swagger
 * /auth/admin/login:
 *   post:
 *     summary: System admin login
 *     tags: [Auth - Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: 'object'
 *             required: ['email', 'password']
 *             properties:
 *               email: { type: 'string', format: 'email' }
 *               password: { type: 'string', format: 'password' }
 *     responses:
 *       200:
 *         description: Login successful.
 *       401:
 *         description: Invalid credentials.
 */
// Public: login only. There is deliberately no admin signup route —
// admins only come to exist via onboarding by an existing super_admin,
// or the one-time bootstrap seed script.
//
// ── SECURITY DECISION (MFA ENABLED) ─────────────────────────────────────────
// Admin login is a TWO-STEP ladder, mirroring the user login flow:
//   1) POST /auth/admin/login        — password check → emails a one-time code.
//   2) POST /auth/admin/verify-otp   — code check → mints access + refresh
//                                      tokens. POST /auth/admin/resend-otp
//                                      issues a fresh code if it expires.
// This replaces the historical password-only gate. Admins remain a small,
// closely-held set (no self-signup; SystemAdmin is a physically separate
// table from User), and every admin action is still individually authorized
// (RequireSystemAdmin / RequireSuperAdmin) and hash-chained into the audit
// log. Tokens remain revocable via the blacklist (POST /auth/admin/logout).
Admin_auth_routes.post('/login', authLimiter, NetworkContextMiddleware, AdminLogin_Controller);

// POST /auth/admin/verify-otp — completes the MFA ladder and returns tokens.
// Requires AuthAdminMiddleware to extract adminId from PART token.
Admin_auth_routes.post('/verify-otp', authLimiter, AuthAdminMiddleware, NetworkContextMiddleware, VerifyAdminOTP_Controller);

// POST /auth/admin/resend-otp — re-emails a fresh one-time code.
// Requires AuthAdminMiddleware to extract adminId from PART token.
Admin_auth_routes.post('/resend-otp', authLimiter, AuthAdminMiddleware, NetworkContextMiddleware, ResendAdminOTP_Controller);

// POST /auth/admin/logout — revokes the admin's access token.
Admin_auth_routes.post(
  '/logout',
  authLimiter,
  AuthMiddleware,
  NetworkContextMiddleware,
  Logout_Controller
);

/**
 * @swagger
 * /auth/admin/onboard:
 *   post:
 *     summary: Onboard a new system admin (super_admin only)
 *     tags: [Auth - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OnboardAdminRequest'
 *     responses:
 *       201:
 *         description: Admin onboarded successfully.
 *       403:
 *         description: Super admin access required.
 */
// Protected: only an authenticated super_admin can create another admin.
Admin_auth_routes.post(
  '/onboard',
  AuthMiddleware,
  NetworkContextMiddleware,
  RequireSuperAdmin,
  OnboardAdmin_Controller
);

export default Admin_auth_routes;
