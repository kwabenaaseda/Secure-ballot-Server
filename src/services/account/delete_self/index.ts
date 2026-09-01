// Imports 

import { AppDataSource } from "../../../config/database";
import { User } from "../../../entities/User";
import { OPS_Error, OPS_Success } from "../../../lib/ops/ops.factory";
import { Service_Error_Handler, Service_Success_Handler } from "../../../types/Response_handler"
import { Authorize } from "../../../utils/ops.manager";
import { DeleteSelfRequestPayload } from "../types";


const EVENT = 'DELETE_ACCOUNT'
const SOURCE = 'Delete_User_Operation'

export async function Delete_User_Operation(params:DeleteSelfRequestPayload):Promise<Service_Success_Handler | Service_Error_Handler>{
   const started_at = Date.now();
  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'VOTER' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['OTP', 'JWT'], confidence: 1.0, mfa_verified: true },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  if (!Authorize(params.role as any, 'account.self','delete')){
     return await OPS_Error({
          ...ops_base,
          status: 'OPERATION_FAILURE',
          message: 'Step-up verification required.',
          error_code: 'FORBIDDEN',
          error_category: 'AUTH',
          retryable: false,
        });
  }
    await AppDataSource.getRepository(User).update(params.userId,{
        verification_status:"unverified",
        user_status:"red"
    })
    return await OPS_Success({
        ...ops_base,
        status: 'COMPLETED',
        message: 'Account deactivated. If this action was unwanted, retrieve your account in 5 days. Read our community guidelines for more information'
          });
}