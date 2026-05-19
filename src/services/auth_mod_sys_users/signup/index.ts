import { Service_Error_Handler, Service_Success_Handler } from "../../../types/Response_handler";
import { CLOCK, Log } from "../../../utils/Logger";
import { SignupPayload } from "./types";
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import { generateOTP } from "../../../utils/otp";
import { sendWelcomeEmail, sendOTPEmail } from "../../../workers/email.service";
import { sendOTPSMS } from "../../../workers/messenger.service";
import {GenerateToken, Hash_Password, Generate_Refresh_Token} from '../../../utils/auth'


export async function Signup_Operation(
  payload: SignupPayload
): Promise<Service_Success_Handler | Service_Error_Handler> {
  try {
    // ── STEP 1: DEPOPULATE PAYLOAD ──────────────────────────
    const {
      username,
      email,
      telephone,
      password,
      date_of_birth,
      nationality_code,
      occupation,
    } = payload;

    // ── STEP 2: CHECK USER UNIQUENESS ───────────────────────
    const userRepository = AppDataSource.getRepository(User);

    const existingUser = await userRepository.findOne({
      where: [
        { email },
        { username },
        { telephone },
      ],
    });

    if (existingUser) {
      // Figure out WHICH field is duplicate for clear error message
      let duplicateField = "account";
      if (existingUser.email === email) duplicateField = "email";
      if (existingUser.username === username) duplicateField = "username";
      if (existingUser.telephone === telephone) duplicateField = "telephone";

      const response: Service_Error_Handler = {
        _OPS_STATS: "OPERATION FAILURE",
        _OPS_META: {
          _timestamp: CLOCK(),
          _event: "SIGNUP",
          _source: Signup_Operation.name,
        },
        success: false,
        _OPS_MESSAGE: `An account with this ${duplicateField} already exists.`,
      };
      return response;
    }

    // ── STEP 3: HASH PASSWORD ────────────────────────────────
    const password_hash = await Hash_Password(password);

    // ── STEP 4: CREATE USER ──────────────────────────────────
    const newUser = new User();
    newUser.username = username;
    newUser.email = email;
    newUser.telephone = telephone;
    newUser.password_hash = password_hash;
    newUser.date_of_birth = new Date(date_of_birth);
    newUser.nationality = nationality_code;
    newUser.occupation = occupation;
    newUser.verification_status = "unverified";

    const savedUser = await userRepository.save(newUser);

    // ── STEP 5: GENERATE OTP ─────────────────────────────────
    // OTP keyed by userId — stored in memory, expires in 5 min
    const otp = await generateOTP(savedUser.id);

    // ── STEP 6: CREATE JWT TOKEN ─────────────────────────────
    const token = await GenerateToken({
        id: savedUser.id,
        email: savedUser.email,
        username: savedUser.username,
      });

    const refresh_token = await Generate_Refresh_Token({id: savedUser.id})

     // Store refresh token in DB or cache with userId for later verification (not implemented here)

    // ── STEP 7: SEND EMAILS (non-blocking) ──────────────────
    // Fire and forget — don't block signup if email fails
    sendWelcomeEmail({
      to: savedUser.email,
      username: savedUser.username,
    }).catch((err) =>
      Log.debug(Signup_Operation.name, `Welcome email failed: ${err}`, "SIGNUP")
    );

    sendOTPEmail({
      to: savedUser.email,
      username: savedUser.username,
      otp,
    }).catch((err) =>
      Log.debug(Signup_Operation.name, `OTP email failed: ${err}`, "SIGNUP")
    );

    // ── STEP 8: SEND OTP TO PHONE ────────────────────────────
    // Non-blocking — don't block signup if SMS fails
    sendOTPSMS(savedUser.telephone, otp).catch((err) =>
      Log.debug(Signup_Operation.name, `OTP SMS failed: ${err}`, "SIGNUP")
    );

    // ── STEP 9: FORMULATE RESPONSE ───────────────────────────
    const response: Service_Success_Handler = {
      _OPS_STATS: "COMPLETED",
      _OPS_META: {
        _timestamp: CLOCK(),
        _event: "SIGNUP",
        _source: Signup_Operation.name,
      },
      _OPS_MESSAGE: "SIGNUP SUCCESSFUL",
      _OPS_DATA: {
        token,
        refresh_token,
        user: {
          id: savedUser.id,
          email: savedUser.email,
          username: savedUser.username,
          verification_status: savedUser.verification_status,
        },
      },
      success: true,
    };

    Log.info(Signup_Operation.name, "Signup Successful", "SIGNUP");
    return response;

  } catch (error) {
    Log.debug(Signup_Operation.name, String(error), "SIGNUP");

    const response: Service_Error_Handler = {
      _OPS_STATS: "SYSTEM FAILURE",
      _OPS_META: {
        _timestamp: CLOCK(),
        _event: "SIGNUP",
        _source: Signup_Operation.name,
      },
      success: false,
      _OPS_MESSAGE: "Unknown Error in Signup Operation",
    };
    return response;
  }
}