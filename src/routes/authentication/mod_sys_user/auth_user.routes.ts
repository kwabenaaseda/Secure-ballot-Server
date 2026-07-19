import Router from 'express'
import type{Request, Response} from 'express'
import { Forgot_Password_Controller, Login_Controller, Signup_Controller, VerifyOTP_Controller } from '../../../controllers/authentication/auth_user.controller'
import { ENV } from '../../../workers/env_validator'
import { AuthMiddleware } from '../../../middleware/auth.middleware'
import { NetworkContextMiddleware } from '../../../middleware/networkContenxt'

const Auth_user = Router()

Auth_user.get('/', async (req:Request, res:Response)=>{
   const apiListing:object ={
            signupUser:{url :`${ENV("API_URL")}/auth/user/signup`, method:"POST"},
            loginUser:{url: `${ENV("API_URL")}/auth/user/login`, method:"POST"},
            recoverPassword:{url: `${ENV("API_URL")}/auth/user/reset`, method:"POST"}
        }
        res.status(200).json(
           apiListing
        )
})

Auth_user.post("/signup",NetworkContextMiddleware, Signup_Controller)
Auth_user.post('/login',NetworkContextMiddleware, Login_Controller)
Auth_user.post('/verify-otp', AuthMiddleware, NetworkContextMiddleware, VerifyOTP_Controller)

// Account recovery
Auth_user.post('/forgot-password', Forgot_Password_Controller)
// Auth_user.post('/reset-password')
// Auth_user.post('/verify-recovery-otp')


export default Auth_user