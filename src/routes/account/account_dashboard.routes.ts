import { Router } from 'express';
import { NetworkContextMiddleware } from '../../middleware/networkContext';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { GetDashboard_Controller } from '../../controllers/account/account_dashboard.controller';

const Account_Dashboardd_Routes = Router();

/**
 * @swagger
 * tags:
 *   - name: Dashboard
 *     description: User dashboard endpoints
 */

/**
 * @swagger
 * /account/dashboard:
 *   get:
 *     summary: Get user dashboard data (orgs, elections, stats)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved.
 *       401:
 *         description: Unauthorized.
 */
Account_Dashboardd_Routes.get(
  '/dashboard',
  AuthMiddleware,
  NetworkContextMiddleware,
  GetDashboard_Controller
);

export default Account_Dashboardd_Routes;
