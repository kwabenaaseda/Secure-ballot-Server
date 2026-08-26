import { Router } from 'express'
import {
  ListUsers_Controller, SetUserStatus_Controller, ListOrganizations_Controller,
  ApproveOrganization_Controller, RejectOrganization_Controller, SuspendOrganization_Controller
} from '../../controllers/admin/admin_management.controller'
import { AuthMiddleware } from '../../middleware/auth.middleware'
import { NetworkContextMiddleware } from '../../middleware/networkContext'
import { RequireSystemAdmin } from '../../middleware/require.system.admin'

const Admin_routes = Router()

Admin_routes.use(AuthMiddleware, NetworkContextMiddleware, RequireSystemAdmin)

Admin_routes.get('/users', ListUsers_Controller)
Admin_routes.patch('/users/:id/status', SetUserStatus_Controller)

Admin_routes.get('/organizations', ListOrganizations_Controller)
Admin_routes.patch('/organizations/:id/approve', ApproveOrganization_Controller)
Admin_routes.patch('/organizations/:id/reject', RejectOrganization_Controller)
Admin_routes.patch('/organizations/:id/suspend', SuspendOrganization_Controller)

export default Admin_routes