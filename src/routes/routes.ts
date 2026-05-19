import express from 'express'
import Auth_user from './authentication/mod_sys_user/auth_user.routes'

const ROUTES = express()

// ------------------- AUTHENTICATION
ROUTES.use("/auth/user", Auth_user)

export default ROUTES