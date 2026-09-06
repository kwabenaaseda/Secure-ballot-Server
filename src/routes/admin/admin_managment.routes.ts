import { Router } from 'express';
import {
  ListUsers_Controller,
  SetUserStatus_Controller,
  ListOrganizations_Controller,
  ApproveOrganization_Controller,
  RejectOrganization_Controller,
  SuspendOrganization_Controller,
} from '../../controllers/admin/admin_management.controller';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../middleware/networkContext';
import { RequireSystemAdmin } from '../../middleware/require.system.admin';

const Admin_routes = Router();

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: System administration endpoints (system admin only)
 */

Admin_routes.use(AuthMiddleware, NetworkContextMiddleware, RequireSystemAdmin);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users (system admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: verification_status
 *         schema:
 *           type: 'string'
 *           enum: ['unverified', 'phone_verified', 'email_verified', 'verified']
 *         description: Filter by verification status
 *     responses:
 *       200:
 *         description: Users list.
 *       403:
 *         description: System admin access required.
 */
Admin_routes.get('/users', ListUsers_Controller);

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     summary: Set user account status (system admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: 'string'
 *           format: 'uuid'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SetUserStatusRequest'
 *     responses:
 *       200:
 *         description: User status updated.
 *       403:
 *         description: System admin access required.
 */
Admin_routes.patch('/users/:id/status', SetUserStatus_Controller);

/**
 * @swagger
 * /admin/organizations:
 *   get:
 *     summary: List all organizations (system admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organizations list.
 *       403:
 *         description: System admin access required.
 */
Admin_routes.get('/organizations', ListOrganizations_Controller);

/**
 * @swagger
 * /admin/organizations/{id}/approve:
 *   patch:
 *     summary: Approve an organization (system admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: 'string'
 *           format: 'uuid'
 *     responses:
 *       200:
 *         description: Organization approved.
 *       403:
 *         description: System admin access required.
 */
Admin_routes.patch('/organizations/:id/approve', ApproveOrganization_Controller);

/**
 * @swagger
 * /admin/organizations/{id}/reject:
 *   patch:
 *     summary: Reject an organization (system admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: 'string'
 *           format: 'uuid'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RejectOrganizationRequest'
 *     responses:
 *       200:
 *         description: Organization rejected.
 *       403:
 *         description: System admin access required.
 */
Admin_routes.patch('/organizations/:id/reject', RejectOrganization_Controller);

/**
 * @swagger
 * /admin/organizations/{id}/suspend:
 *   patch:
 *     summary: Suspend an organization (system admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: 'string'
 *           format: 'uuid'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SuspendOrganizationRequest'
 *     responses:
 *       200:
 *         description: Organization suspended.
 *       403:
 *         description: System admin access required.
 */
Admin_routes.patch('/organizations/:id/suspend', SuspendOrganization_Controller);

export default Admin_routes;
