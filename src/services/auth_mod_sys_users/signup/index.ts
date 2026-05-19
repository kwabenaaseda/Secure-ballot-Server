// This is the service layer for the signup operation for the account user.
// Flows : Biometic available && OTP request

import { Service_Error_Handler, Service_Success_Handler } from "../../../types/Response_handler";
import { CLOCK, Log } from "../../../utils/Logger";
import { SignupPayload } from "./types";

export async function Signup_Operation(payload: SignupPayload):Promise<Service_Success_Handler|Service_Error_Handler>{
    try {
        // DEPOPULATE PAYLOAD.
      
        // Check DB for user existence -> User is unique (telephone, email, username)

        // Hash Password

        // Generate OTP from  hash pasword

        // Create User - without biometric
        
        // Create Token

        // Formulate _OPS_DATA

        // Send Validation Mail + Welcome -> Email

        // Send OTP to Phone -> Validate phone

         // Send Operation Respoonse

        const response: Service_Success_Handler = {
            _OPS_STATS:"COMPLETED",
            _OPS_META:{
                _timestamp: CLOCK(),
                _event: "SIGNUP",
                _source: Signup_Operation.name
            },
            _OPS_MESSAGE:"SIGNUP SUCCESSFUL",
            _OPS_DATA:{},
            success: true
        }

        Log.info(Signup_Operation.name, "Signup Successful","SIGNUP")
        return response

    } catch (error) {

        Log.debug(Signup_Operation.name,String(error),"SIGNUP")

        const response: Service_Error_Handler = {
            _OPS_STATS:'SYSTEM FAILURE',
            _OPS_META:{
                _timestamp: CLOCK(),
                _event:"SIGNUP",
                _source: Signup_Operation.name
            },
            success: false,
            _OPS_MESSAGE:"Unkown Error in Signup Operation",
        }
        return response
    }
}