import Router from 'express';
import {
  AdminLogin_Controller,
  OnboardAdmin_Controller,
} from '../../../controllers/authentication/admin_auth.controller';
import { AuthMiddleware } from '../../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../../middleware/networkContext';
import { RequireSuperAdmin } from '../../../middleware/require.system.admin';

const Admin_auth_routes = Router();

// Public: login only. There is deliberately no admin signup route —
// admins only come to exist via onboarding by an existing super_admin,
// or the one-time bootstrap seed script.
Admin_auth_routes.post('/login', NetworkContextMiddleware, AdminLogin_Controller);

// Protected: only an authenticated super_admin can create another admin.
Admin_auth_routes.post(
  '/onboard',
  AuthMiddleware,
  NetworkContextMiddleware,
  RequireSuperAdmin,
  OnboardAdmin_Controller
);

export default Admin_auth_routes;
