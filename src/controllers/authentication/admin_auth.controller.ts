import { Request, Response } from 'express';
import { AdminLogin_Operation } from '../../services/auth_mod_sys_admin/login';
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

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
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