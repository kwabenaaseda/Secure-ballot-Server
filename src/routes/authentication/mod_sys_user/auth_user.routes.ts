import Router from 'express'
import type{Request, Response} from 'express'
import { Login_Controller, Signup_Controller, VerifyOTP_Controller } from '../../../controllers/authentication/auth_user.controller'
import { ENV } from '../../../workers/env_validater'
import { AuthMiddleware } from '../../../middleware/auth.middleware'

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

Auth_user.post("/signup",Signup_Controller)
Auth_user.post('/login',Login_Controller)
Auth_user.post('/verify-otp', AuthMiddleware, VerifyOTP_Controller)

export default Auth_user