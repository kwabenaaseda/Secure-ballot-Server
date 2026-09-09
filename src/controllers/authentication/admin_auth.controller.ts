import { Request, Response } from 'express';
import { AdminLogin_Operation } from '../../services/auth_mod_sys_admin/login';
import {
  AdminVerifyOTP_Operation,
  AdminResendOTP_Operation,
} from '../../services/auth_mod_sys_admin/otp_verify';
import { OnboardAdmin_Operation } from '../../services/auth_mod_sys_admin/onbaord';

export async function AdminLogin_Controller(req: Request, res: Response) {
  const { email, password } = req.body;

  const result = await AdminLogin_Operation({
    email,
    password,
    network: req.networkContext!,
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  // Step 1: password verified → MFA required. The client holds the admin id
  // (from the response body) and must call /auth/admin/verify-otp next.
  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function VerifyAdminOTP_Controller(req: Request, res: Response) {
  // Extract adminId from the PART token (set by AuthAdminMiddleware)
  const adminId = req.admin?.id;
  const { otp } = req.body;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Invalid or missing admin session.',
    });
  }

  const result = await AdminVerifyOTP_Operation({
    adminId,
    otp,
    network: req.networkContext!,
  });

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

export async function ResendAdminOTP_Controller(req: Request, res: Response) {
  // Extract adminId from the PART token (set by AuthAdminMiddleware)
  const adminId = req.admin?.id;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Invalid or missing admin session.',
    });
  }

  const result = await AdminResendOTP_Operation({
    adminId,
    network: req.networkContext!,
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

export async function OnboardAdmin_Controller(req: Request, res: Response) {
  const { email, username, level } = req.body;

  const result = await OnboardAdmin_Operation({
    email,
    username,
    level,
    onboarded_by: req.user!.id,
    network: req.networkContext!,
  });

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
