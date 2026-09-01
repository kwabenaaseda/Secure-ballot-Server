import { Router } from 'express';
import { NetworkContextMiddleware } from '../../middleware/networkContext';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import {
  DeleteSelf_Controller,
  GetSelf_Controller,
  RequestMutationOTP_Controller,
  UpdateSelf_Controller,
  VerifyMutationOTP_Controller,
} from '../../controllers/account/account_settings.controller';

const Account_Settings_Routes = Router();

Account_Settings_Routes.post(
  '/request-mutation-otp',
  AuthMiddleware,
  NetworkContextMiddleware,
  RequestMutationOTP_Controller
);
Account_Settings_Routes.post(
  '/verify-mutation-otp',
  AuthMiddleware,
  NetworkContextMiddleware,
  VerifyMutationOTP_Controller
);
Account_Settings_Routes.patch('/', AuthMiddleware, NetworkContextMiddleware, UpdateSelf_Controller);
Account_Settings_Routes.delete(
  '/',
  AuthMiddleware,
  NetworkContextMiddleware,
  DeleteSelf_Controller
);
Account_Settings_Routes.get('/', AuthMiddleware, NetworkContextMiddleware, GetSelf_Controller);

export default Account_Settings_Routes;
