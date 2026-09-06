import Router from 'express';
import {
  AdminLogin_Controller,
  OnboardAdmin_Controller,
} from '../../../controllers/authentication/admin_auth.controller';
import { AuthMiddleware } from '../../../middleware/auth.middleware';
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
// ── STATED SECURITY DECISION (Tier 0.5) ──────────────────────────────────────
// Admin login is PASSWORD-ONLY — no OTP step. This is an explicitly accepted
// risk, not an oversight: (1) the admin population is a small, closely-held
// set with no self-signup path; (2) SystemAdmin is a physically separate
// table from User, so user credentials can never satisfy this gate;
// (3) every admin action is individually authorized (RequireSystemAdmin /
// RequireSuperAdmin) and individually written to the hash-chained audit log;
// (4) tokens are revocable via the blacklist (POST /auth/admin/logout).
// If the admin population grows, the containment path is to add the standard
// OTP ladder here (generateOTP + Brevo/Vonage send, mirroring user login).
Admin_auth_routes.post('/login', authLimiter, NetworkContextMiddleware, AdminLogin_Controller);

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
