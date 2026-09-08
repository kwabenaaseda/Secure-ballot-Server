import Router from 'express';
import type { Request, Response } from 'express';
import {
  Forgot_Password_Controller,
  Login_Controller,
  ResendOTP_Controller,
  Signup_Controller,
  VerifyOTP_Controller,
  VerifyRecoveryOTP_Controller,
  ResetPassword_Controller,
  RefreshTokens_Controller,
} from '../../../controllers/authentication/auth_user.controller';
import { ENV } from '../../../workers/env_validator';
import { AuthMiddleware } from '../../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../../middleware/networkContext';
import { authLimiter } from '../../../middleware/rateLimit';
import { Logout_Controller } from '../../../controllers/auth/logout.controller';

const Auth_user = Router();

/**
 * @swagger
 * tags:
 *   - name: Auth - User
 *     description: User authentication endpoints
 */

/**
 * @swagger
 * /auth/user:
 *   get:
 *     summary: List available auth endpoints
 *     tags: [Auth - User]
 *     responses:
 *       200:
 *         description: API listing
 */
Auth_user.get('/', async (_req: Request, res: Response) => {
  const apiListing: object = {
    signupUser: { url: `${ENV('API_URL')}/auth/user/signup`, method: 'POST' },
    loginUser: { url: `${ENV('API_URL')}/auth/user/login`, method: 'POST' },
    recoverPassword: { url: `${ENV('API_URL')}/auth/user/forgot-password`, method: 'POST' },
  };
  res.status(200).json(apiListing);
});

/**
 * @swagger
 * /auth/user/signup:
 *   post:
 *     summary: Register a new user account
 *     tags: [Auth - User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *     responses:
 *       201:
 *         description: Signup successful. OTP sent to email and phone.
 *       400:
 *         description: Invalid input or account already exists
 */
Auth_user.post('/signup', authLimiter, NetworkContextMiddleware, Signup_Controller);

/**
 * @swagger
 * /auth/user/login:
 *   post:
 *     summary: Login with email/username and password
 *     tags: [Auth - User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful. OTP sent for verification.
 *       401:
 *         description: Invalid credentials
 */
Auth_user.post('/login', authLimiter, NetworkContextMiddleware, Login_Controller);

/**
 * @swagger
 * /auth/user/biometric/login/start:
 *   post:
 *     summary: Start a WebAuthn biometric login (returns assertion options)
 *     tags: [Auth - User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               identifier:
 *                 type: string
 *     responses:
 *       200:
 *         description: WebAuthn assertion options
 *       400:
 *         description: Invalid request or no enrolled credentials
 */
Auth_user.post('/biometric/login/start', authLimiter, NetworkContextMiddleware, (req, res) =>
  // controller handles validation
  require('../../../controllers/authentication/auth_user.controller').BiometricLoginStart_Controller(req, res)
);

/**
 * @swagger
 * /auth/user/biometric/login/finish:
 *   post:
 *     summary: Finish a WebAuthn biometric login (verify assertion)
 *     tags: [Auth - User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               response:
 *                 type: object
 *     responses:
 *       200:
 *         description: Login successful. Tokens returned.
 *       401:
 *         description: Verification failed.
 */
Auth_user.post('/biometric/login/finish', authLimiter, NetworkContextMiddleware, (req, res) =>
  require('../../../controllers/authentication/auth_user.controller').BiometricLoginFinish_Controller(req, res)
);

/**
 * @swagger
 * /auth/user/verify-otp:
 *   post:
 *     summary: Verify OTP code to complete authentication
 *     tags: [Auth - User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *     responses:
 *       200:
 *         description: OTP verified. Full access token issued.
 *       400:
 *         description: Invalid or expired OTP
 */
Auth_user.post(
  '/verify-otp',
  authLimiter,
  AuthMiddleware,
  NetworkContextMiddleware,
  VerifyOTP_Controller
);

/**
 * POST /auth/user/logout — revokes the presented access token (jti -> token_blacklist).
 */
Auth_user.post(
  '/logout',
  authLimiter,
  AuthMiddleware,
  NetworkContextMiddleware,
  Logout_Controller
);

/**
 * @swagger
 * /auth/user/resend-otp:
 *   post:
 *     summary: Resend a new OTP code
 *     tags: [Auth - User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New OTP sent to email and phone.
 *       400:
 *         description: Invalid request
 */
Auth_user.post(
  '/resend-otp',
  authLimiter,
  AuthMiddleware,
  NetworkContextMiddleware,
  ResendOTP_Controller
);

/**
 * @swagger
 * /auth/user/forgot-password:
 *   post:
 *     summary: Initiate password reset flow
 *     tags: [Auth - User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset OTP sent.
 *       400:
 *         description: Invalid request
 */
Auth_user.post('/forgot-password', authLimiter, NetworkContextMiddleware, Forgot_Password_Controller);

/**
 * @swagger
 * /auth/user/verify-recovery-otp:
 *   post:
 *     summary: Verify OTP for password reset
 *     tags: [Auth - User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *     responses:
 *       200:
 *         description: OTP verified. Token issued for password reset.
 *       400:
 *         description: Invalid or expired OTP
 */
Auth_user.post(
  '/verify-recovery-otp',
  authLimiter,
  NetworkContextMiddleware,
  VerifyRecoveryOTP_Controller
);

/**
 * @swagger
 * /auth/user/reset-password:
 *   post:
 *     summary: Reset password after OTP verification
 *     tags: [Auth - User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset successful.
 *       400:
 *         description: Invalid request
 */
Auth_user.post(
  '/reset-password',
  authLimiter,
  AuthMiddleware,
  NetworkContextMiddleware,
  ResetPassword_Controller
);

/**
 * POST /auth/user/refresh — exchange a valid refresh token for a fresh
 * access + refresh pair (rotation: the presented token is blacklisted).
 */
Auth_user.post('/refresh', authLimiter, NetworkContextMiddleware, RefreshTokens_Controller);

export default Auth_user;
