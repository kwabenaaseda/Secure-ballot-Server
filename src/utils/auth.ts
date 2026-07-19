// Tokens and Bcrypts

import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import { ENV } from "../workers/env_validator"

//=================== TOKENS =========================
const ACCESS_TOKEN_EXPIRY = ENV("JWT_EXPIRATION") || "24h"
const REFRESH_TOKEN_EXPIRY = ENV("JWT_REFRESH_EXPIRATION") || '48h'


export async function GenerateToken({id, email, username,range}: {id:string, email:string, username:string,range:"access"|"temporary"|"reset"
}): Promise<string> {
    const options = {
        expiresIn:  range=="access"? ACCESS_TOKEN_EXPIRY:
                    range=="temporary"?"15m":
                    range=="reset"?"5m":"1m",
    } as jwt.SignOptions

    // use an object payload and ensure the secret is treated as jwt.Secret
    const payload = { sub: id, email:email, username:username, range:range }

    var token = jwt.sign(
        payload,
        ENV("JWT_SECRET") as jwt.Secret,
        options
    )
    return token
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



//==================== BCRYPT ===========================

export async function Hash_Password(password:string){
    const salt = 10
    return bcrypt.hash(password, salt)
}

export async function Verify_Hash(password:string, hash:string){
    return bcrypt.compare(password, hash)
}