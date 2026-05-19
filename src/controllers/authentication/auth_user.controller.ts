import { Request, Response } from 'express';
import { SignupSchema } from '../../services/auth_mod_sys_users/signup/types';
import { Signup_Operation } from '../../services/auth_mod_sys_users/signup';
import { Log } from '../../utils/Logger';

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