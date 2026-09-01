import Router from 'express';
import {
  CreateOrganization_Controller,
  Get_Org_Detail,
  Search_Org,
} from '../../controllers/organization/organization.controller';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../middleware/networkContext';

const Org_routes = Router();

Org_routes.post('/create', AuthMiddleware, NetworkContextMiddleware, CreateOrganization_Controller);
Org_routes.get('/search', AuthMiddleware, NetworkContextMiddleware, Search_Org);
Org_routes.get('/:orgId', AuthMiddleware, NetworkContextMiddleware, Get_Org_Detail);

export default Org_routes;
