import { OPS_Error, OPS_Success } from "../../../lib/ops/ops.factory";
import { NetworkContext } from "../../../lib/ops/ops.types";
import { Service_Error_Handler, Service_Success_Handler } from "../../../types/Response_handler";
import { Log } from "../../../utils/Logger";
import Operations_Manager, { ACTION, LOCATION, RESOURCE } from "../../../utils/ops.manager";
import { generateOTP } from "../../../utils/otp";
import { sendOTPEmail } from "../../../workers/email.service";
import { sendOTPSMS } from "../../../workers/messenger.service";

interface Payload {
    userId: string,
    email: string,
    username: string,
    network: NetworkContext,
    telephone: string
}

const SOURCE = "RESEND_OTP"
const EVENT = "Resending_OTP"

export async function Resend_OTP(params: Payload): Promise<Service_Error_Handler | Service_Success_Handler> {
    const started_at = Date.now()
    // Base OPS context shared across all return paths in this operation
    const ops_base = {
        event: EVENT,
        source: SOURCE,
        actor_type: "SYSTEM" as const,   // pre-auth — no actor identity yet
        actor_id: params.email,       // hashed inside OPS factory
        started_at,
        network: params.network,
        auth: {
            factors_used: ["PASSWORD"],
            confidence: 1.0,
            mfa_verified: false,           // OTP verification is a separate operation
        },
        classification: "INTERNAL" as const,
        integrity_class: "SENSITIVE" as const,
    };
    try {
        const { email, userId, username, network, telephone } = params
        if (!email || !userId || !username || !network || !telephone) {
            return await OPS_Error({
                ...ops_base,
                status: "OPERATION_FAILURE",
                message: "All required fields must be provided.",
                error_code: "MISSING_REQUIRED_FIELDS",
                error_category: "VALIDATION",
                retryable: true,
            });
        }
        let ops = await Operations_Manager({ user_id: userId, location: "domestic" });

        if (ops === false) {
            return await OPS_Error({
                ...ops_base,
                status: "OPERATION_FAILURE",
                message: "Unable to resolve access profile for this account.",
                error_code: "PROFILE_RESOLUTION_FAILED",
                error_category: "AUTH",
                retryable: true,
            });
        }
        // Create otp 
        const otp = await generateOTP(userId)

        // Resend otp
        sendOTPEmail({ to: email, username: username, otp })
            .catch((err) => Log.debug(SOURCE, `OTP email failed: ${err}`, EVENT));

        sendOTPSMS(telephone, otp)
            .catch((err) => Log.debug(SOURCE, `OTP SMS failed: ${err}`, EVENT));
        return await OPS_Success({
            ...ops_base,
            // Now we know the actor — update from email to real user ID
            actor_id: userId,
            actor_type: "VOTER",
            status: "COMPLETED",
            message: "Signup successful. OTP sent to email and phone.",
        });
    } catch (error) {
        Log.debug(SOURCE, String(error), EVENT);

        return await OPS_Error({
            ...ops_base,
            status: "SYSTEM_FAILURE",
            message: `An unexpected error occurred during ${EVENT}. `,
            error_code: "INTERNAL_ERROR",
            error_category: "SYSTEM",
            retryable: true,
            retry_after_ms: 5000,
            stack_ref: `${EVENT}_${ops_base.started_at}`, // references internal log, not raw stack
        });
    };
}
