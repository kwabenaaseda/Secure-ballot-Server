import { Router } from 'express';
import { NetworkContextMiddleware } from '../../middleware/networkContext';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import {
  DeleteSelf_Controller,
  GetSelf_Controller,
  RequestMutationOTP_Controller,
  UpdateSelf_Controller,
  VerifyMutationOTP_Controller,
} from '../../controllers/account/account_settings.controller';

const Account_Settings_Routes = Router();

/**
 * @swagger
 * tags:
 *   - name: Account
 *     description: Account management endpoints
 */

/**
 * @swagger
 * /account/settings:
 *   get:
 *     summary: Get current user account details
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account details retrieved.
 *       401:
 *         description: Unauthorized.
 */
Account_Settings_Routes.get('/', AuthMiddleware, NetworkContextMiddleware, GetSelf_Controller);

/**
 * @swagger
 * /account/settings/request-mutation-otp:
 *   post:
 *     summary: Request OTP for account mutation (step-up auth)
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OTP sent for step-up verification.
 *       401:
 *         description: Unauthorized.
 */
Account_Settings_Routes.post(
  '/request-mutation-otp',
  AuthMiddleware,
  NetworkContextMiddleware,
  RequestMutationOTP_Controller
);

/**
 * @swagger
 * /account/settings/verify-mutation-otp:
 *   post:
 *     summary: Verify OTP for account mutation (step-up auth)
 *     tags: [Account]
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
 *         description: Step-up verified. Token issued for account mutation.
 *       400:
 *         description: Invalid OTP.
 */
Account_Settings_Routes.post(
  '/verify-mutation-otp',
  AuthMiddleware,
  NetworkContextMiddleware,
  VerifyMutationOTP_Controller
);

/**
 * @swagger
 * /account/settings:
 *   patch:
 *     summary: Update account details (requires step-up auth)
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAccountRequest'
 *     responses:
 *       200:
 *         description: Account updated.
 *       400:
 *         description: Invalid input or step-up required.
 */
Account_Settings_Routes.patch('/', AuthMiddleware, NetworkContextMiddleware, UpdateSelf_Controller);

/**
 * @swagger
 * /account/settings:
 *   delete:
 *     summary: Delete account (soft delete, requires step-up auth)
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deactivated.
 *       400:
 *         description: Step-up required.
 */
Account_Settings_Routes.delete(
  '/',
  AuthMiddleware,
  NetworkContextMiddleware,
  DeleteSelf_Controller
);

export default Account_Settings_Routes;
