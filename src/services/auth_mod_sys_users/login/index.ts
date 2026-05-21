import { Service_Success_Handler, Service_Error_Handler } from "../../../types/Response_handler";
import { CLOCK, Log } from "../../../utils/Logger";
import { LoginPayload } from "./types";
import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import { Verify_Hash, GenerateToken, Generate_Refresh_Token } from "../../../utils/auth";

export async function Login_Operation(
  payload: LoginPayload
): Promise<Service_Success_Handler | Service_Error_Handler> {
  try {
    const { identifier, password } = payload;

    // ── STEP 1: VALIDATE FIELDS ──────────────────────────
    if (!identifier || !password) {
      return {
        _OPS_STATS: "OPERATION FAILURE",
        _OPS_META: {
          _timestamp: CLOCK(),
          _event: "LOGIN",
          _source: Login_Operation.name,
        },
        success: false,
        _OPS_MESSAGE: "Identifier and password are required.",
      };
    }

    // ── STEP 2: FIND USER BY EMAIL OR USERNAME ───────────
    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: [
        { email: identifier },
        { username: identifier },
      ],
    });

    // ── STEP 3: USER NOT FOUND ───────────────────────────
    // Deliberately vague message (security: don't reveal if email exists)
    if (!user) {
      return {
        _OPS_STATS: "OPERATION FAILURE",
        _OPS_META: {
          _timestamp: CLOCK(),
          _event: "LOGIN",
          _source: Login_Operation.name,
        },
        success: false,
        _OPS_MESSAGE: "Invalid credentials.",
      };
    }

    // ── STEP 4: COMPARE PASSWORD ─────────────────────────
    const password_match = await Verify_Hash(password, user.password_hash);

    if (!password_match) {
      return {
        _OPS_STATS: "OPERATION FAILURE",
        _OPS_META: {
          _timestamp: CLOCK(),
          _event: "LOGIN",
          _source: Login_Operation.name,
        },
        success: false,
        _OPS_MESSAGE: "Invalid credentials.",
      };
    }

    // ── STEP 5: GENERATE TOKENS ──────────────────────────
    const token = await GenerateToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    const refresh_token = await Generate_Refresh_Token({ id: user.id });

    // ── STEP 6: RETURN RESPONSE ──────────────────────────
    const response: Service_Success_Handler = {
      _OPS_STATS: "COMPLETED",
      _OPS_META: {
        _timestamp: CLOCK(),
        _event: "LOGIN",
        _source: Login_Operation.name,
      },
      _OPS_MESSAGE: "LOGIN SUCCESSFUL",
      _OPS_DATA: {
        token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          verification_status: user.verification_status,
        },
      },
      success: true,
    };

    Log.info(Login_Operation.name, "Login Successful", "LOGIN");
    return response;

  } catch (error) {
    Log.debug(Login_Operation.name, String(error), "LOGIN");

    return {
      _OPS_STATS: "SYSTEM FAILURE",
      _OPS_META: {
        _timestamp: CLOCK(),
        _event: "LOGIN",
        _source: Login_Operation.name,
      },
      success: false,
      _OPS_MESSAGE: "Unknown Error in Login Operation",
    };
  }
}