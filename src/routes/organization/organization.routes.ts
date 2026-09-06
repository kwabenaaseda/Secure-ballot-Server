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
} from '../../controllers/organization/organization.controller';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../middleware/networkContext';

const Org_routes = Router();

Org_routes.post('/create', AuthMiddleware, NetworkContextMiddleware, CreateOrganization_Controller);
Org_routes.get('/search', AuthMiddleware, NetworkContextMiddleware, Search_Org);
Org_routes.get('/:orgId', AuthMiddleware, NetworkContextMiddleware, Get_Org_Detail);
Org_routes.delete('/:orgId', AuthMiddleware, NetworkContextMiddleware, DeleteOrganization_Controller);

// ── Membership & join management ────────────────────────────────────────────
Org_routes.post('/:orgId/join', AuthMiddleware, NetworkContextMiddleware, JoinOrganization_Controller);

// Org-admin member management
Org_routes.get('/:orgId/members', AuthMiddleware, NetworkContextMiddleware, ListOrgMembers_Controller);
Org_routes.patch('/:orgId/members/:memberId/role', AuthMiddleware, NetworkContextMiddleware, UpdateMemberRole_Controller);
Org_routes.patch('/:orgId/members/:memberId/status', AuthMiddleware, NetworkContextMiddleware, UpdateMemberStatus_Controller);

// Org-admin join request review
Org_routes.get('/:orgId/join-requests', AuthMiddleware, NetworkContextMiddleware, ListPendingJoinRequests_Controller);
Org_routes.post('/:orgId/join-requests/:memberId/approve', AuthMiddleware, NetworkContextMiddleware, ApproveJoinRequest_Controller);
Org_routes.post('/:orgId/join-requests/:memberId/deny', AuthMiddleware, NetworkContextMiddleware, DenyJoinRequest_Controller);

export default Org_routes;
