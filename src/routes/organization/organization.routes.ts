import Router from 'express';
import {
  CreateOrganization_Controller,
  Get_Org_Detail,
  Search_Org,
  JoinOrganization_Controller,
  ListOrgMembers_Controller,
  UpdateMemberRole_Controller,
  UpdateMemberStatus_Controller,
  ListPendingJoinRequests_Controller,
  ApproveJoinRequest_Controller,
  DenyJoinRequest_Controller,
  DeleteOrganization_Controller,
  VerifyOrgCode_Controller,
  UploadRoster_Controller,
  GetRosterSummary_Controller,
} from '../../controllers/organization/organization.controller';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../middleware/networkContext';

const Org_routes = Router();

/**
 * @swagger
 * tags:
 *   - name: Organizations
 *     description: Organization management endpoints
 */

/**
 * @swagger
 * /org/create:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrganizationRequest'
 *     responses:
 *       201:
 *         description: Organization created.
 *       400:
 *         description: Invalid input.
 */
Org_routes.post('/create', AuthMiddleware, NetworkContextMiddleware, CreateOrganization_Controller);
/**
 * @swagger
 * /org/search:
 *   get:
 *     summary: Search organizations
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Search results.
 */
Org_routes.get('/search', AuthMiddleware, NetworkContextMiddleware, Search_Org);
/**
 * @swagger
 * /org/{orgId}:
 *   get:
 *     summary: Get organization detail
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Organization detail.
 */
Org_routes.get('/:orgId', AuthMiddleware, NetworkContextMiddleware, Get_Org_Detail);
/**
 * @swagger
 * /org/{orgId}:
 *   delete:
 *     summary: Delete an organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Organization deleted.
 */
Org_routes.delete('/:orgId', AuthMiddleware, NetworkContextMiddleware, DeleteOrganization_Controller);

// ── Membership & join management ────────────────────────────────────────────
// Passcode gate MUST be registered before /:orgId/join.
/**
 * @swagger
 * /org/{orgId}/verify-code:
 *   post:
 *     summary: Verify private org join passcode
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOrgCodeRequest'
 *     responses:
 *       200:
 *         description: Passcode verified.
 *       400:
 *         description: Invalid passcode.
 */
Org_routes.post('/:orgId/verify-code', AuthMiddleware, NetworkContextMiddleware, VerifyOrgCode_Controller);
// Open an organization-scoped session (issues org-scoped token)
/**
 * @swagger
 * /org/{orgId}/open:
 *   post:
 *     summary: Open an organization-scoped session
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Org-scoped token issued.
 */
Org_routes.post('/:orgId/open', AuthMiddleware, NetworkContextMiddleware, async (req, res) => {
  const { OpenOrgSession_Controller } = await import('../../controllers/organization/organization.controller');
  return OpenOrgSession_Controller(req, res);
});
/**
 * @swagger
 * /org/{orgId}/join:
 *   post:
 *     summary: Request to join an organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/JoinOrganizationRequest'
 *     responses:
 *       200:
 *         description: Join request submitted.
 */
Org_routes.post('/:orgId/join', AuthMiddleware, NetworkContextMiddleware, JoinOrganization_Controller);

// Org-admin member management
/**
 * @swagger
 * /org/{orgId}/members:
 *   get:
 *     summary: List organization members (org admin)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Members list.
 */
Org_routes.get('/:orgId/members', AuthMiddleware, NetworkContextMiddleware, ListOrgMembers_Controller);
/**
 * @swagger
 * /org/{orgId}/members/{memberId}/role:
 *   patch:
 *     summary: Change member role (org admin only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMemberRoleRequest'
 *     responses:
 *       200:
 *         description: Member role updated.
 */
Org_routes.patch('/:orgId/members/:memberId/role', AuthMiddleware, NetworkContextMiddleware, UpdateMemberRole_Controller);
/**
 * @swagger
 * /org/{orgId}/members/{memberId}/status:
 *   patch:
 *     summary: Activate or deactivate a member (org admin only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMemberStatusRequest'
 *     responses:
 *       200:
 *         description: Member status updated.
 */
Org_routes.patch('/:orgId/members/:memberId/status', AuthMiddleware, NetworkContextMiddleware, UpdateMemberStatus_Controller);

// Org-admin join request review
/**
 * @swagger
 * /org/{orgId}/join-requests:
 *   get:
 *     summary: List pending join requests (org admin)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Pending join requests.
 */
Org_routes.get('/:orgId/join-requests', AuthMiddleware, NetworkContextMiddleware, ListPendingJoinRequests_Controller);
/**
 * @swagger
 * /org/{orgId}/join-requests/{memberId}/approve:
 *   post:
 *     summary: Approve a join request (org admin)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Join request approved.
 */
Org_routes.post('/:orgId/join-requests/:memberId/approve', AuthMiddleware, NetworkContextMiddleware, ApproveJoinRequest_Controller);
/**
 * @swagger
 * /org/{orgId}/join-requests/{memberId}/deny:
 *   post:
 *     summary: Deny a join request (org admin)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Join request denied.
 */
Org_routes.post('/:orgId/join-requests/:memberId/deny', AuthMiddleware, NetworkContextMiddleware, DenyJoinRequest_Controller);

// Org-admin roster import (BYOI pre-verification)
/**
 * @swagger
 * /org/{orgId}/roster:
 *   get:
 *     summary: Get roster summary (org admin)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Roster summary.
 */
Org_routes.get('/:orgId/roster', AuthMiddleware, NetworkContextMiddleware, GetRosterSummary_Controller);
/**
 * @swagger
 * /org/{orgId}/roster:
 *   post:
 *     summary: Upload member roster CSV (org admin)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UploadRosterRequest'
 *     responses:
 *       200:
 *         description: Roster uploaded.
 */
Org_routes.post('/:orgId/roster', AuthMiddleware, NetworkContextMiddleware, UploadRoster_Controller);

export default Org_routes;
