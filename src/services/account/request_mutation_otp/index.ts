// src/services/account/request_mutation_otp/index.ts
import { generateOTP } from "../../../utils/otp";
import { sendOTPEmail } from "../../../workers/email.service";
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import { OPS_Success, OPS_Error } from "../../../lib/ops/ops.factory";
import { NetworkContext } from "../../../lib/ops/ops.types";

export async function RequestMutationOTP_Operation(params: { userId: string; network: NetworkContext }) {
    const started_at = Date.now();
    const ops_base = {
        event: "REQUEST_MUTATION_OTP", source: "RequestMutationOTP_Operation",
        actor_type: "VOTER" as const, actor_id: params.userId, started_at, network: params.network,
        auth: { factors_used: ["JWT"], confidence: 1.0, mfa_verified: false },
        classification: "INTERNAL" as const, integrity_class: "SENSITIVE" as const,
    };

    const user = await AppDataSource.getRepository(User).findOneBy({ id: params.userId });
    if (!user) {
        return await OPS_Error({ ...ops_base, status: "OPERATION_FAILURE", message: "User not found.", error_code: "USER_NOT_FOUND", error_category: "VALIDATION", retryable: false });
    }

    const otp = await generateOTP(user.id);
    await sendOTPEmail({ to: user.email, username: user.username, otp })
        .catch((err) => console.error("Mutation OTP email failed:", err));

    return await OPS_Success({ ...ops_base, status: "COMPLETED", message: "Verification code sent. Confirm to proceed with account changes." });
}