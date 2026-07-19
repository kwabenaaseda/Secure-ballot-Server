import Router from 'express'
import { CastVote_Controller } from '../../controllers/voting/voting.controller'
import { AuthMiddleware } from '../../middleware/auth.middleware'
import { NetworkContextMiddleware } from '../../middleware/networkContenxt'

const Voting_routes = Router()

Voting_routes.post('/cast', AuthMiddleware, NetworkContextMiddleware, CastVote_Controller)

export default Voting_routes