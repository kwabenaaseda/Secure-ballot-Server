import type {Request, Response} from 'express'
import { Log } from '../../utils/Logger'
import type{ General_Error_Handler, General_Success_Handler } from '../../types/Response_handler'
import type { SignupPayload } from '../../services/auth_mod_sys_users/signup/types' 


export const SIGNUP_USER = async (req:Request , res: Response) =>{

    try {
        // Depopulate exact components from request payload
        const {
            username,
            email,
            telephone,
            password,
            date_of_birth,
            nationality_code,
            occupation
        }:SignupPayload = req.body

        // Input Marhsalling
        if (!username || username.length < 8){
            Log.info(SIGNUP_USER.name,"User Failed username Check [!username || username.length < 8]","SIGNUP")
            const response: General_Error_Handler = {
                success: false,
                err_message: "Username must be at least 8 characters",
                guidelines: "Enter valid username of 8 characters"
            }
            return res.status(400).json(response)
        }
        if (!username || username.length < 8){
            Log.info(SIGNUP_USER.name,"User Failed username Check [!username || username.length < 8]","SIGNUP")
            const response: General_Error_Handler = {
                success: false,
                err_message: "Username must be at least 8 characters",
                guidelines: "Enter valid username of 8 characters"
            }
            return res.status(400).json(response)
        }

        Log.info(SIGNUP_USER.name,"Successfull Signup","SIGNUP") 
         
        const response: General_Success_Handler = {
            success_message : "Your account has been created Successfully. Happy Voting!",
            sucess:true,
            data:{
                token:"Testing12123456789o0",
                user:{
                    fullname:"Kofi",
                }
            }
        }
        res.status(200).json(response)
    } catch (error) {
        if (typeof error =="string"){
        Log.debug(SIGNUP_USER.name,error,"SIGNUP")

        const response: General_Error_Handler = {
            success: false,
            err_message: "An Error Occurred in creating your account",
            guidelines:"Please Try Again!"
        }
        res.status(500).json(response)
    }
    else {
       
        Log.debug(SIGNUP_USER.name,String(error),"SIGNUP")

        const response: General_Error_Handler = {
            success: false,
            err_message: "An Error Occurred in creating your account",
            guidelines:"Please Try Again!"
        }
        res.status(500).json(response)
    } 
        
    }
}