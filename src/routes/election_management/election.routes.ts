import Router from 'express'
import { CreateElection_Controller, AddCandidate_Controller } from '../../controllers/election_management/election.controller'
import { AuthMiddleware } from '../../middleware/auth.middleware'
import { NetworkContextMiddleware } from '../../middleware/networkContenxt'

const Election_routes = Router()

Election_routes.post('/create', AuthMiddleware, NetworkContextMiddleware, CreateElection_Controller)
Election_routes.post('/candidate', AuthMiddleware, NetworkContextMiddleware, AddCandidate_Controller)

export default Election_routes