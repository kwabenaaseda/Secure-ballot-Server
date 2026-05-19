// Tokens and Bcrypts

import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

//=================== TOKENS =========================
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRATION || "24h"
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRATION || '48h'


export function GenerateToken(id:string){
    const options = {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        subject: id,
    } as jwt.SignOptions

    // use an object payload and ensure the secret is treated as jwt.Secret
    const payload = { sub: id }

    var token = jwt.sign(
        payload,
        process.env.JWT_SECRET as jwt.Secret,
        options
    )
    return token
}


export function VerifyToken(token:string){
    return jwt.verify(token,
        process.env.JWT_SECRET as jwt.Secret,
        {ignoreExpiration: false}
    )
}

export function Generate_Refresh_Token(id:string){
    const options = {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        subject: id,
    } as jwt.SignOptions

    // use an object payload and ensure the secret is treated as jwt.Secret
    const payload = { sub: id }

    var token = jwt.sign(
        payload,
        process.env.JWT_SECRET as jwt.Secret,
        options
    )
    return token
}



//==================== BCRYPT ===========================

export function Hash_Password(password:string){
    const salt = 10
    return bcrypt.hash(password, salt)
}

export async function Verify_Hash(password:string, hash:string){
    return bcrypt.compare(password, hash)
}