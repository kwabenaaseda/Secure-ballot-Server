import express from 'express'
import Auth_user from './authentication/mod_sys_user/auth_user.routes'
import Org_routes from './organization/organization.routes'
import Election_routes from './election_management/election.routes'
import Voting_routes from './voting/voting.routes'

const ROUTES = express()

// ------------------- AUTHENTICATION
ROUTES.use("/auth/user", Auth_user)

// ------------------- ORGANIZATION
ROUTES.use("/org", Org_routes)

// ------------------- ELECTION MANAGEMENT
ROUTES.use("/election", Election_routes)

// ------------------- VOTING
ROUTES.use("/vote", Voting_routes)

export default ROUTES