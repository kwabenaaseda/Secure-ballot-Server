import { Request, Response } from 'express';
import { SignupSchema } from '../../services/auth_mod_sys_users/signup/types';
import { Signup_Operation } from '../../services/auth_mod_sys_users/signup';
import { LoginSchema } from '../../services/auth_mod_sys_users/login/types';
import { Login_Operation } from '../../services/auth_mod_sys_users/login';
import { Forgot_Password } from '../../services/auth_mod_sys_users/account_recovery/forgot_password';
import { ResetSchema } from '../../services/auth_mod_sys_users/account_recovery/forgot_password/types';
import { VerifyAccount_Operation } from '../../services/auth_mod_sys_users/otp_verify';
// controllers/authentication/auth_user.controller.ts — add
import { Resend_OTP } from '../../services/auth_mod_sys_users/resendOTP';

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
  });
}
