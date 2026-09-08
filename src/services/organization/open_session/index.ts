import { AppDataSource } from '../../../config/database';
import { OrgMembers } from '../../../entities/OrgMembers';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import Operations_Manager from '../../../utils/ops.manager';
import { GenerateToken, Generate_Refresh_Token } from '../../../utils/auth';

const SOURCE = 'OpenOrgSession_Operation';

export async function OpenOrgSession_Operation(params: {
  orgId: string;
  userId: string;
  network: any;
}) {
  const started_at = Date.now();
  const ops_base = {
    event: 'OPEN_ORG_SESSION',
    source: SOURCE,
    actor_type: 'VOTER' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
    org_id: params.orgId,
  };

  try {
    // Confirm membership and status
    const membership = await AppDataSource.getRepository(OrgMembers).findOne({
      where: { org: { id: params.orgId }, user: { id: params.userId } },
      relations: ['user'],
    });
    if (!membership || membership.status !== 'active') {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'You are not an active member of this organization.',
        error_code: 'NOT_ORG_MEMBER',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    // Resolve full operations profile for organization context
    const ops = await Operations_Manager({ user_id: params.userId, org_id: params.orgId, location: 'organization' });
    if (ops === false) {
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Unable to resolve access profile for this account.',
        error_code: 'PROFILE_RESOLUTION_FAILED',
        error_category: 'AUTH',
        retryable: true,
      });
    }

    const token_payload = {
      id: params.userId,
      username: membership.user?.username ?? '',
      email: membership.user?.email ?? '',
      network: params.network,
      verification: membership.user?.verification_status ?? 'unverified',
      user_status: membership.user?.user_status ?? 'yellow',
      range: ops.role,
    } as any;

    const token = await GenerateToken(token_payload);
    const refresh_token = await Generate_Refresh_Token({ id: params.userId });

    Log.info(SOURCE, `Opened org session for ${params.userId} -> ${params.orgId}`, 'OPEN_ORG_SESSION');

    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Organization session opened.',
      data: { token, refresh_token, role: ops.role },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'OPEN_ORG_SESSION');
    return await OPS_Error({
      ...ops_base,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to open organization session.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `OPEN_ORG_SESSION_${started_at}`,
    });
  }
}
