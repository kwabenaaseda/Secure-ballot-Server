import Router from 'express'
import { CreateOrganization_Controller } from '../../controllers/organization/organization.controller'
import { AuthMiddleware } from '../../middleware/auth.middleware'
import { NetworkContextMiddleware } from '../../middleware/networkContenxt'

const Org_routes = Router()

Org_routes.post('/create', AuthMiddleware, NetworkContextMiddleware, CreateOrganization_Controller)

export default Org_routes