import { NetworkContext } from "../lib/ops/ops.types";
import bcrypt from "bcrypt"
import { Request } from "express";

export function getNetworkContext(req: Request): NetworkContext{
    // --- Return context
    return {
        ip_hash: "",
        device_fingerprint_hash: "",
        user_agent_class : "BROWSER",
        correlation_id : "",
        session_id : ""
    }
}
// Helpers

async function IP_HASH(ip: string) {
    const salt = 14
    return bcrypt.hash(ip,salt)
}