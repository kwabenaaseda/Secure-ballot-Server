import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { SystemAdmin } from '../../../entities/SystemAdmin';
import { Hash_Password } from '../../../utils/auth';
import { NetworkContext } from '../../../lib/ops/ops.types';
import crypto from 'node:crypto';

const EVENT = 'SYSTEM_ADMIN_ONBOARD';
const SOURCE = 'AdminOnboard_Operation';

interface OnboardAdminPayload {
  email: string;
  username: string;
  level: 'admin' | 'super_admin';
  onboarded_by: string; // id of the super_admin doing the onboarding
  network: NetworkContext;
}

export async function OnboardAdmin_Operation(
  payload: OnboardAdminPayload
): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const { email, username, level, onboarded_by, network } = payload;

  const ops_base = {
    event: EVENT,
    source: SOURCE,
    actor_type: 'SYSTEM_ADMIN' as const,
    actor_id: onboarded_by,
    started_at,
    network,
    auth: { factors_used: ['SESSION'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    if (!email || !username || !level) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'email, username, and level are required.',
        error_code: 'MISSING_REQUIRED_FIELDS',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    const adminRepo = queryRunner.manager.getRepository(SystemAdmin);
    const existing = await adminRepo.findOne({ where: [{ email }, { username }] });
    if (existing) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'An admin with this email or username already exists.',
        error_code: 'DUPLICATE_FIELD',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    // Generated, one-time temp password. Real flow: send via a side
    // channel (SMS/email) and force-reset on first login — that reset
    // endpoint is a fast follow-up, not blocking today's ship.
    const temp_password = crypto.randomBytes(9).toString('base64url');
    const password_hash = await Hash_Password(temp_password);

    const newAdmin = queryRunner.manager.create(SystemAdmin, {
      email,
      username,
      level,
      password_hash,
      status: 'active',
      created_by: onboarded_by,
    });
    const saved = await queryRunner.manager.save(newAdmin);

    await queryRunner.commitTransaction();
    Log.info(SOURCE, 'System admin onboarded', EVENT);

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Admin onboarded successfully.',
      data: {
        admin: { id: saved.id, email: saved.email, username: saved.username, level: saved.level },
        temp_password, // shown once — caller is responsible for delivering it securely
      },
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), EVENT);
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: `An unexpected error occurred during ${EVENT}. `,
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `${EVENT}_${started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}
