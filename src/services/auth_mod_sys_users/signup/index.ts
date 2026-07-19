import { Service_Error_Handler, Service_Success_Handler } from "../../../types/Response_handler";
import { OPS_Success, OPS_Error } from "../../../lib/ops/ops.factory";
import { Log } from "../../../utils/Logger";
import { SignupPayload } from "./types/index";
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import { generateOTP } from "../../../utils/otp";
import { sendWelcomeEmail, sendOTPEmail } from "../../../workers/email.service";
import { sendOTPSMS } from "../../../workers/messenger.service";
import { GenerateToken, Hash_Password, Generate_Refresh_Token } from "../../../utils/auth";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const EVENT  = "SIGNUP";
const SOURCE = "Signup_Operation";

// ─── SIGNUP OPERATION ─────────────────────────────────────────────────────────

export async function Signup_Operation(
  payload: SignupPayload
): Promise<Service_Success_Handler | Service_Error_Handler> {

  // Capture start time immediately — duration_ms is measured from here
  const started_at = Date.now();

  // Base OPS context shared across all return paths in this operation
  const ops_base = {
    event:      EVENT,
    source:     SOURCE,
    actor_type: "SYSTEM" as const,   // pre-auth — no actor identity yet
    actor_id:   payload.email,       // hashed inside OPS factory
    started_at,
    network:    payload.network,
    auth: {
      factors_used: ["PASSWORD"],
      confidence:   1.0,
      mfa_verified: false,           // OTP verification is a separate operation
    },
    classification:  "INTERNAL"  as const,
    integrity_class: "SENSITIVE" as const,
  };

  try {
    // ── STEP 1: VALIDATE REQUIRED FIELDS ──────────────────────────────────────
    const { username, email, telephone, password, date_of_birth, nationality_code, occupation } = payload;

    if (!email || !username || !telephone || !password) {
      return await OPS_Error({
        ...ops_base,
        status:          "OPERATION_FAILURE",
        message:         "All required fields must be provided.",
        error_code:      "MISSING_REQUIRED_FIELDS",
        error_category:  "VALIDATION",
        retryable:       true,
      });
    }

    // ── STEP 2: CHECK UNIQUENESS ───────────────────────────────────────────────
    const userRepository = AppDataSource.getRepository(User);

    const existingUser = await userRepository.findOne({
      where: [{ email }, { username }, { telephone }],
    });

    if (existingUser) {
      let duplicateField = "account";
      if (existingUser.email      === email)     duplicateField = "email";
      if (existingUser.username   === username)  duplicateField = "username";
      if (existingUser.telephone  === telephone) duplicateField = "telephone";

      return await OPS_Error({
        ...ops_base,
        status:         "OPERATION_FAILURE",
        message:        `An account with this ${duplicateField} already exists.`,
        error_code:     "DUPLICATE_FIELD",
        error_category: "VALIDATION",
        retryable:      false,
        data:           { duplicate_field: duplicateField },
      });
    }

    // ── STEP 3: HASH PASSWORD ──────────────────────────────────────────────────
    const password_hash = await Hash_Password(password);

    // ── STEP 4: CREATE USER ────────────────────────────────────────────────────
    const newUser        = new User();
    newUser.username     = username;
    newUser.email        = email;
    newUser.telephone    = telephone;
    newUser.password_hash = password_hash;
    newUser.date_of_birth = new Date(date_of_birth);
    newUser.nationality  = nationality_code;
    newUser.occupation   = occupation;
    newUser.verification_status = "unverified";

    const savedUser = await userRepository.save(newUser);

    // ── STEP 5: GENERATE OTP ───────────────────────────────────────────────────
    const otp = await generateOTP(savedUser.id);

    // ── STEP 6: GENERATE TOKENS ────────────────────────────────────────────────
    const token = await GenerateToken({
      id:       savedUser.id,
      email:    savedUser.email,
      username: savedUser.username,
      range:    "access",
    });

    const refresh_token = await Generate_Refresh_Token({ id: savedUser.id });

    // ── STEP 7: FIRE NOTIFICATIONS (non-blocking) ──────────────────────────────
    sendWelcomeEmail({ to: savedUser.email, username: savedUser.username })
      .catch((err) => Log.debug(SOURCE, `Welcome email failed: ${err}`, EVENT));

    sendOTPEmail({ to: savedUser.email, username: savedUser.username, otp })
      .catch((err) => Log.debug(SOURCE, `OTP email failed: ${err}`, EVENT));

    sendOTPSMS(savedUser.telephone, otp)
      .catch((err) => Log.debug(SOURCE, `OTP SMS failed: ${err}`, EVENT));

    // ── STEP 8: RETURN SUCCESS ─────────────────────────────────────────────────
    Log.info(SOURCE, "Signup successful", EVENT);

    return await OPS_Success({
      ...ops_base,
      // Now we know the actor — update from email to real user ID
      actor_id:   savedUser.id,
      actor_type: "VOTER",
      status:     "COMPLETED",
      message:    "Signup successful. OTP sent to email and phone.",
      data: {
        token,
        refresh_token,
        user: {
          id:                  savedUser.id,
          email:               savedUser.email,
          username:            savedUser.username,
          verification_status: savedUser.verification_status,
        },
      },
    });

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
     };
  }