import { Router } from 'express';
import {
  ListUsers_Controller,
  SetUserStatus_Controller,
  ListOrganizations_Controller,
  ApproveOrganization_Controller,
  RejectOrganization_Controller,
  SuspendOrganization_Controller,
  ListAuditLogs_Controller,
  GetAuditLogStats_Controller,
} from '../../controllers/admin/admin_management.controller';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../middleware/networkContext';
import { RequireSystemAdmin } from '../../middleware/require.system.admin';
import { LoadPermissionCache } from '../../utils/ops.manager';

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
 * /admin/permissions/reload:
 *   post:
 *     summary: Reload the permission matrix from the DB (system admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions reloaded.
 *       403:
 *         description: System admin access required.
 */
Admin_routes.post('/permissions/reload', async (_req, res) => {
  try {
    await LoadPermissionCache();
    return res.status(200).json({ success: true, message: 'Permission cache reloaded.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to reload permissions.' });
  }
});

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

// ─── AUDIT LOG ROUTES ───────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: List audit logs (system admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: actor_type
 *         schema:
 *           type: string
 *           enum: ['VOTER', 'ORG_ADMIN', 'SYSTEM', 'SCHEDULER', 'KEYHOLDER', 'AUDITOR']
 *       - in: query
 *         name: event
 *         schema:
 *           type: string
 *       - in: query
 *         name: success
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Audit logs list.
 *       403:
 *         description: System admin access required.
 */
Admin_routes.get('/audit-logs', ListAuditLogs_Controller);

/**
 * @swagger
 * /admin/audit-logs/stats:
 *   get:
 *     summary: Get audit log statistics (system admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit log statistics.
 *       403:
 *         description: System admin access required.
 */
Admin_routes.get('/audit-logs/stats', GetAuditLogStats_Controller);

export default Admin_routes;
