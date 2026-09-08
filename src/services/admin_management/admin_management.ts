import { Service_Error_Handler, Service_Success_Handler } from '../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../lib/ops/ops.factory';
import { Log } from '../../utils/Logger';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Organization } from '../../entities/Organization';
import { AuditLog } from '../../entities/audit_log';
import { NetworkContext } from '../../lib/ops/ops.types';

const SOURCE = 'AdminManagement_Operation';

function base(event: string, admin_id: string, network: NetworkContext) {
  return {
    event,
    source: SOURCE,
    actor_type: 'SYSTEM_ADMIN' as const,
    actor_id: admin_id,
    started_at: Date.now(),
    network,
    auth: { factors_used: ['SESSION'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
  };
}

// ── LIST USERS (with optional verification_status filter) ──────────────────
export async function ListUsers_Operation(payload: {
  admin_id: string;
  network: NetworkContext;
  verification_status?: User['verification_status'];
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ADMIN_LIST_USERS', payload.admin_id, payload.network);
  try {
    const repo = AppDataSource.getRepository(User);
    const where = payload.verification_status
      ? { verification_status: payload.verification_status }
      : {};
    const users = await repo.find({
      where,
      select: ['id', 'email', 'username', 'verification_status', 'user_status', 'created_at'],
      order: { created_at: 'DESC' },
      take: 100,
    });
    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Users retrieved.',
      data: { users, count: users.length },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'ADMIN_LIST_USERS');
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to retrieve users.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ADMIN_LIST_USERS_${ops_base.started_at}`,
    });
  }
}

// ── SET USER STATUS (green/yellow/red) — moderation action ─────────────────
export async function SetUserStatus_Operation(payload: {
  admin_id: string;
  network: NetworkContext;
  user_id: string;
  user_status: User['user_status'];
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ADMIN_SET_USER_STATUS', payload.admin_id, payload.network);
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const repo = queryRunner.manager.getRepository(User);
    const user = await repo.findOneBy({ id: payload.user_id });
    if (!user) {
      await queryRunner.rollbackTransaction();
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'User not found.',
        error_code: 'USER_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }
    user.user_status = payload.user_status;
    await queryRunner.manager.save(user);
    await queryRunner.commitTransaction();
    Log.info(
      SOURCE,
      `User ${user.id} status set to ${payload.user_status}`,
      'ADMIN_SET_USER_STATUS'
    );
    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'User status updated.',
      data: { user_id: user.id, user_status: user.user_status },
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    Log.debug(SOURCE, String(error), 'ADMIN_SET_USER_STATUS');
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to update user status.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ADMIN_SET_USER_STATUS_${ops_base.started_at}`,
    });
  } finally {
    await queryRunner.release();
  }
}

// ── LIST ORGANIZATIONS ───────────────────────────────────────────────────────
export async function ListOrganizations_Operation(payload: {
  admin_id: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ADMIN_LIST_ORGS', payload.admin_id, payload.network);
  try {
    const repo = AppDataSource.getRepository(Organization);
    const orgs = await repo.find({ order: { name: 'ASC' }, take: 100 });
    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Organizations retrieved.',
      data: { organizations: orgs, count: orgs.length },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'ADMIN_LIST_ORGS');
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to retrieve organizations.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ADMIN_LIST_ORGS_${ops_base.started_at}`,
    });
  }
}

// ── LIST AUDIT LOGS ───────────────────────────────────────────────────────────
export async function ListAuditLogs_Operation(payload: {
  admin_id: string;
  network: NetworkContext;
  limit?: number;
  offset?: number;
  actor_type?: string;
  event?: string;
  success?: boolean;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ADMIN_LIST_AUDIT_LOGS', payload.admin_id, payload.network);
  try {
    const repo = AppDataSource.getRepository(AuditLog);
    const where: any = {};
    
    if (payload.actor_type) where.actor_type = payload.actor_type;
    if (payload.event) where.event = payload.event;
    if (payload.success !== undefined) where.success = payload.success;

    const [logs, total] = await repo.findAndCount({
      where,
      order: { sequence_number: 'DESC' },
      take: payload.limit ?? 100,
      skip: payload.offset ?? 0,
    });

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Audit logs retrieved.',
      data: { 
        logs: logs.map(l => ({
          id: l.id,
          sequence_number: l.sequence_number,
          event: l.event,
          event_id: l.event_id,
          source: l.source,
          actor_type: l.actor_type,
          actor_id: l.actor_id,
          org_id: l.org_id,
          election_id: l.election_id,
          success: l.success,
          ops_status: l.ops_status,
          ops_message: l.ops_message,
          error_code: l.error_code,
          error_category: l.error_category,
          classification: l.classification,
          integrity_class: l.integrity_class,
          threat_score: l.threat_score,
          threat_signals: l.threat_signals,
          auth_factors_used: l.auth_factors_used,
          auth_confidence: l.auth_confidence,
          mfa_verified: l.mfa_verified,
          ip_hash: l.ip_hash,
          user_agent_class: l.user_agent_class,
          entry_hash: l.entry_hash,
          chain_hash: l.chain_hash,
          signed_by: l.signed_by,
          log_segment_id: l.log_segment_id,
          duration_ms: l.duration_ms,
          created_at: l.created_at,
        })),
        total,
        limit: payload.limit ?? 100,
        offset: payload.offset ?? 0,
      },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'ADMIN_LIST_AUDIT_LOGS');
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to retrieve audit logs.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ADMIN_LIST_AUDIT_LOGS_${ops_base.started_at}`,
    });
  }
}

// ── GET AUDIT LOG STATS ──────────────────────────────────────────────────────
export async function GetAuditLogStats_Operation(payload: {
  admin_id: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const ops_base = base('ADMIN_AUDIT_LOG_STATS', payload.admin_id, payload.network);
  try {
    const repo = AppDataSource.getRepository(AuditLog);
    
    const totalCount = await repo.count();
    const successCount = await repo.count({ where: { success: true } });
    const failureCount = await repo.count({ where: { success: false } });
    
    const actorTypeCounts = await repo
      .createQueryBuilder('a')
      .select('a.actor_type', 'actor_type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.actor_type')
      .getRawMany();
    
    const eventCounts = await repo
      .createQueryBuilder('a')
      .select('a.event', 'event')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.event')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const threatScoreAvg = await repo
      .createQueryBuilder('a')
      .select('AVG(a.threat_score)', 'avg')
      .getRawOne();

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Audit log stats retrieved.',
      data: {
        total_count: totalCount,
        success_count: successCount,
        failure_count: failureCount,
        success_rate: totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : 0,
        actor_type_breakdown: actorTypeCounts,
        top_events: eventCounts,
        avg_threat_score: threatScoreAvg?.avg ?? 0,
      },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'ADMIN_AUDIT_LOG_STATS');
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to retrieve audit log stats.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `ADMIN_AUDIT_LOG_STATS_${ops_base.started_at}`,
    });
  }
}
