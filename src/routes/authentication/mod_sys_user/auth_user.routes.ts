import Router from 'express'
import type{Request, Response} from 'express'
import { SIGNUP_USER } from '../../../controllers/authentication/auth_user.controller'

const Auth_user = Router()

Auth_user.get('/', async (req:Request, res:Response)=>{
   const apiListing:object ={
            signupUser:{url :`${process.env.API_URL}/auth/user/signup`, method:"POST"},
            loginUser:{url: `${process.env.API_URL}/auth/user/login`, method:"POST"},
            recoverPassword:{url: `${process.env.API_URL}/auth/user/reset`, method:"POST"}
        }
        res.status(200).json(
           apiListing
        )
})

Auth_user.post("/signup",SIGNUP_USER)

export default Auth_user