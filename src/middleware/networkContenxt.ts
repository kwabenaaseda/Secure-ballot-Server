import { Request, Response, NextFunction } from "express"
import { Log } from "../utils/Logger"
import { NetworkContext } from "../lib/ops/ops.types"
import bcrypt from "bcrypt"
import crypto from "node:crypto"

declare global {
    namespace Express {
        interface Request {
            networkContext?: NetworkContext
        }
    }
}


// ---- Helper functions set

async function IP_HASH(ip: string | string[]) {
    const raw = JSON.stringify(ip)
    const salt = 11;
    return await bcrypt.hash(raw, salt)
}

function CorrelationID() {
    return crypto.randomUUID()
}

function USER_AGENT(agent: string) {
    if (agent.toLowerCase().includes("mobile")) {
        return "MOBILE_APP"
    } else {
        return "BROWSER"
    }
}


export async function NetworkContextMiddleware(
    req: Request,
    res: Response,
    next: NextFunction) {
        
    Log.info(NetworkContextMiddleware.name, "Attempting Network Context extraction", "SYSTEM_NETWORK_CONTEXT_EXTRACTION");
    try {
         // Session ID
         const _session = req.user?.token ? req.user.token : "NONE"

        // -- GET IP AND HASH IT
       // -- GET IP AND HASH IT
const _ip = req.ip
Log.info(NetworkContextMiddleware.name, `IP extracted from request: ${_ip}`, "SYSTEM_NETWORK_CONTEXT_EXTRACTION");

if (!_ip) {
  Log.warn(NetworkContextMiddleware.name, "Possible Infiltration detected", "NO_IP_FROM_SOURCE")
  return res.status(401).json({
    success: false,
    message: "Unauthorized. No token provided.",
  });
}

        const _ip_hash = await IP_HASH(_ip)

        // Create correlation ID
        const _correlationID = CorrelationID()
        // -- Get user_agent_class
        const _user_agent = req.headers["user-agent"]
        
        if (!_user_agent) {
            Log.warn(NetworkContextMiddleware.name, "Possible Infiltration detected", "NO_IP_FROM_SOURCE")
            return res.status(401).json({
                success: false,
            })
        }

        const _user_agent_class = USER_AGENT(_user_agent)

        // set stage
        req.networkContext = {
            ip_hash: _ip_hash,
            user_agent_class: _user_agent_class,
            correlation_id: _correlationID,
            session_id: _session

        }
        next();
    } catch (error) {
        Log.warn(NetworkContextMiddleware.name, String(error), "NETWORK_CONTEXT");
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Invalid or expired token.",
    });
    }

}