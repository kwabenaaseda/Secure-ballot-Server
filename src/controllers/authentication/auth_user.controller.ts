import { Request, Response } from 'express';
import { SignupSchema } from '../../services/auth_mod_sys_users/signup/types';
import { Signup_Operation } from '../../services/auth_mod_sys_users/signup';
import { LoginSchema } from '../../services/auth_mod_sys_users/login/types';
import { Login_Operation } from '../../services/auth_mod_sys_users/login';
import { Forgot_Password } from '../../services/auth_mod_sys_users/account_recovery/forgot_password';
import { ResetSchema } from '../../services/auth_mod_sys_users/account_recovery/forgot_password/types';
import { VerifyAccount_Operation } from '../../services/auth_mod_sys_users/otp_verify';
import { Resend_OTP } from '../../services/auth_mod_sys_users/resendOTP';
import { Verify_Reset_Password_OTP } from '../../services/auth_mod_sys_users/account_recovery/reset_verify_otp';
import { ResetPassword_Operation } from '../../services/auth_mod_sys_users/account_recovery/reset_password';
import { RefreshTokens_Operation } from '../../services/auth/refresh';
import { BiometricLoginStart_Operation } from '../../services/biometric/login/start';
import { BiometricLoginFinish_Operation } from '../../services/biometric/login/finish';
import { z } from 'zod';

// The OTP was already proven by verify-recovery-otp, whose 5-minute Bearer
// token IS the step-up proof here — so the body carries only the new password.
const ResetPasswordSchema = z.object({
  new_password: z.string().min(8),
});

export async function ResendOTP_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const userId = req.user?.id;
  if (!network || !userId) {
    return res.status(400).json({ success: false, message: 'Invalid User' });
  }
  const result = await Resend_OTP({ userId, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }
  return res.status(200).json({ success: true, message: result._OPS_MESSAGE });
}

export async function Signup_Controller(req: Request, res: Response) {
  // Validate input
  const parsed = SignupSchema.safeParse(req.body);
  const network = req.networkContext;

  if (!network || network == undefined) {
    return res.status(400).json({
      success: false,
      message: 'Invalid User',
    });
  }
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  // Call service
  const params = { ...parsed.data, network };
  const result = await Signup_Operation(params);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}
export async function Login_Controller(req: Request, res: Response) {
  const parsed = LoginSchema.safeParse(req.body);
  const network = req.networkContext;

  if (!network || network == undefined) {
    return res.status(400).json({
      success: false,
      message: 'Invalid User',
    });
  }

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const params = { ...parsed.data, network };

  const result = await Login_Operation(params);

  if (!result.success) {
    return res.status(401).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function VerifyOTP_Controller(req: Request, res: Response) {
  const { otp } = req.body;
  const userId = req.user?.id;
  const network = req.networkContext;

  if (!network || network == undefined) {
    return res.status(400).json({
      success: false,
      message: 'Invalid User',
    });
  }

  if (!otp || !userId) {
    return res.status(400).json({
      success: false,
      message: 'OTP is required.',
    });
  }

  const params = { userId, otp, network };
  const result = await VerifyAccount_Operation(params);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA, // ← this line was missing
  });
}
export async function Forgot_Password_Controller(req: Request, res: Response) {
  const parsed = ResetSchema.safeParse(req.body);
  const network = req.networkContext;

  if (!network || network == undefined) {
    return res.status(400).json({
      success: false,
      message: 'Invalid User',
    });
  }

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const result = await Forgot_Password(parsed.data, network);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA, // { user_id } — the client needs it for verify-recovery-otp
  });
}

export async function VerifyRecoveryOTP_Controller(req: Request, res: Response) {
  const { otp, userId } = req.body;
  const network = req.networkContext;

  if (!network) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request.',
    });
  }

  if (!otp || !userId) {
    return res.status(400).json({
      success: false,
      message: 'OTP and userId are required.',
    });
  }

  const result = await Verify_Reset_Password_OTP({ userId, otp, network });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function ResetPassword_Controller(req: Request, res: Response) {
  const parsed = ResetPasswordSchema.safeParse(req.body);
  const network = req.networkContext;
  const userId = req.user?.id;

  if (!network || !userId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request.',
    });
  }

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const result = await ResetPassword_Operation({
    userId,
    new_password: parsed.data.new_password,
    network,
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
  });
}

export async function RefreshTokens_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const refresh_token = req.body?.refresh_token;

  if (!network) {
    return res.status(400).json({ success: false, message: 'Invalid request.' });
  }
  if (!refresh_token || typeof refresh_token !== 'string') {
    return res.status(400).json({ success: false, message: 'refresh_token is required.' });
  }

  const result = await RefreshTokens_Operation({ refresh_token, network });

  if (!result.success) {
    return res.status(401).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function BiometricLoginStart_Controller(req: Request, res: Response) {
  const { identifier } = req.body;
  const network = req.networkContext;

  if (!network) {
    return res.status(400).json({ success: false, message: 'Invalid request.' });
  }

  // identifier is optional - if not provided, use discoverable credentials flow
  const params = { identifier, network } as any;
  const result = await BiometricLoginStart_Operation(params);

  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
}

export async function BiometricLoginFinish_Controller(req: Request, res: Response) {
  const { userId, response } = req.body;
  const network = req.networkContext;

  if (!network) {
    return res.status(400).json({ success: false, message: 'Invalid request.' });
  }

  // userId is optional for discoverable credentials flow
  if (!response) {
    return res.status(400).json({ success: false, message: 'response is required.' });
  }

  const params = { userId, response, network } as any;
  const result = await BiometricLoginFinish_Operation(params);

  if (!result.success) {
    return res.status(401).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
}
