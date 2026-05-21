import { Request, Response } from 'express';
import { SignupSchema } from '../../services/auth_mod_sys_users/signup/types';
import { Signup_Operation } from '../../services/auth_mod_sys_users/signup';
import { Log } from '../../utils/Logger';
import { LoginSchema } from '../../services/auth_mod_sys_users/login/types';
import { Login_Operation } from '../../services/auth_mod_sys_users/login';

export async function Signup_Controller(req: Request, res: Response) {
  // Validate input
  const parsed = SignupSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  // Call service
  const result = await Signup_Operation(parsed.data);

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

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const result = await Login_Operation(parsed.data);

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