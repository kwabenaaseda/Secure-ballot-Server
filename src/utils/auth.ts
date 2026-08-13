// Tokens and Bcrypts

import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import { ENV } from "../workers/env_validator"
import { Log } from "./Logger"
import { auth_generate_token_payload } from "./types"
import { OPS_Error } from "../lib/ops/ops.factory"
import { Service_Error_Handler } from "../types/Response_handler"

//=================== TOKENS =========================
const ACCESS_TOKEN_EXPIRY = ENV("JWT_EXPIRATION") || "24h"
const REFRESH_TOKEN_EXPIRY = ENV("JWT_REFRESH_EXPIRATION") || '48h'


export async function GenerateToken({id, email, username,range,verification,user_status,network,data}: auth_generate_token_payload): Promise<Service_Error_Handler|string|boolean> {
   const EVENT = "GENERATE_TOKEN_EVENT";
   const SOURCE = "GENERATE_TOKEN"

    // Capture start time immediately — duration_ms is measured from here
  const started_at = Date.now();

     if(!id || !email || !username || !verification || !user_status || !range || !network ){
        Log.debug(SOURCE,"Refer to token payload",EVENT)
        return false
    }

  // Base OPS context shared across all return paths in this operation
  const ops_base = {
    event:      EVENT,
    source:     SOURCE,
    actor_type: "SYSTEM" as const,   // pre-auth — no actor identity yet
    actor_id:   email,       // hashed inside OPS factory
    started_at,
    network:    network,
    auth: {
      factors_used: ["PASSWORD"],
      confidence:   1.0,
      mfa_verified: false,           // OTP verification is a separate operation
    },
    classification:  "INTERNAL"  as const,
    integrity_class: "SENSITIVE" as const,
  };

try {
    let EXPIRY = "5m"
    if (range == "ACCOUNT_ACCESS[FULL]" || range == "ORG_ACCESS[FULL]" || range =="SYSTEM_ADMIN" || range =="NO_ACCESS" || range == "SELF_ACCOUNT_ACCESS" || range =="ORG_ACCESS[PART]" ){
        EXPIRY = ACCESS_TOKEN_EXPIRY
    }
    else if (range == 'ACCOUNT_ACCESS[PART]' || range == 'VOTER_ACCESS_PASS[FULL]' || range =='VOTER_ACCESS_PASS[PART]'){
        EXPIRY = "8m"
    }

    const options = {
        expiresIn:  EXPIRY
    } as jwt.SignOptions

    // use an object payload and ensure the secret is treated as jwt.Secret
    const payload = { sub: id, email:email, username:username, range:range, verification:verification, user_status:user_status, data:data?data:false}

    var token = jwt.sign(
        payload,
        ENV("JWT_SECRET") as jwt.Secret,
        options
    )
    return token
} catch (error) {
      Log.debug(SOURCE, String(error), EVENT);
    
       return await OPS_Error({
                ...ops_base,
                status:         "SYSTEM_FAILURE",
                message:        `An unexpected error occurred during ${EVENT}. `,
                error_code:     "INTERNAL_ERROR",
                error_category: "SYSTEM",
                retryable:      true,
                retry_after_ms: 5000,
                stack_ref:      `${EVENT}_${ops_base.started_at}`, // references internal log, not raw stack
              });
}

    
}


export async function VerifyToken(token:string){
    return jwt.verify(token,
        ENV("JWT_SECRET") as jwt.Secret,
        {ignoreExpiration: false}
    )
}

export async function Generate_Refresh_Token({id}:{id:string}){
    const options = {
        expiresIn: REFRESH_TOKEN_EXPIRY,
    } as jwt.SignOptions

    // use an object payload and ensure the secret is treated as jwt.Secret
    const payload = { sub: id }

    var token = jwt.sign(
        payload,
        ENV("JWT_SECRET") as jwt.Secret,
        options
    )
    return token
}

// Helper function


//==================== BCRYPT ===========================

export async function Hash_Password(password:string){
    const salt = 10
    return bcrypt.hash(password, salt)
}

export async function Verify_Hash(password:string, hash:string){
    return bcrypt.compare(password, hash)
}