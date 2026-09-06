// src/services/Election_management/list_elections/index.ts
// GET /election/org/:orgId — list elections for one organization.
// Visibility rules:
//   - Org admins/moderators see every election (incl. drafts).
//   - Active members see published/closed elections.
//   - Non-members are limited to public orgs' public (is_public) elections.

import { AppDataSource } from '../../../config/database';
import { Election } from '../../../entities/Election';
import { Organization } from '../../../entities/Organization';
import { OrgMembers } from '../../../entities/OrgMembers';
import { VoteRecord } from '../../../entities/Vote_record';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { NetworkContext } from '../../../lib/ops/ops.types';
import { effectiveElectionStatus } from '../helpers/election.status';

export async function ListElections_Operation(params: {
  orgId: string;
  userId: string;
  network: NetworkContext;
}) {
  const started_at = Date.now();
  const ops_base = {
    event: 'LIST_ELECTIONS',
    source: 'ListElections_Operation',
    actor_type: 'VOTER' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'STANDARD' as const,
    org_id: params.orgId,
  };

  const org = await AppDataSource.getRepository(Organization).findOneBy({ id: params.orgId });
  if (!org) {
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: 'Organization not found.',
      error_code: 'ORG_NOT_FOUND',
      error_category: 'VALIDATION',
      retryable: false,
    });
  }

  const membership = await AppDataSource.getRepository(OrgMembers).findOne({
    where: { org: { id: org.id }, user: { id: params.userId } },
  });
  const isAdmin =
    !!membership && membership.status === 'active' && ['admin', 'moderator'].includes(membership.role);
  const isMember = !!membership && membership.status === 'active';

  const elections = await AppDataSource.getRepository(Election).find({
    where: { org: { id: org.id } },
    relations: ['org'],
    order: { created_at: 'DESC' },
  });

  const visible = elections.filter((e) => {
    const effective = effectiveElectionStatus(e);
    if (isAdmin) return true;
    if (effective === 'draft') return false;
    if (isMember) return true;
    // Non-member: only public org + public election
    if (org.visibility === 'public' && e.is_public) return true;
    return false;
  });

  const voteRepo = AppDataSource.getRepository(VoteRecord);
  const mapped = await Promise.all(
    visible.map(async (e) => ({
      id: e.id,
      org_id: e.org.id,
      org_name: e.org.name,
      name: e.name,
      summary: e.summary,
      status: effectiveElectionStatus(e),
      categories: e.categories ?? [],
      visibility: e.visibility,
      is_public: e.is_public,
      results_status: e.results_status,
      start_at: e.start_at,
      end_at: e.end_at,
      registration_cutoff_at: e.registration_cutoff_at,
      has_voted: isMember
        ? (await voteRepo.count({
            where: { user: { id: params.userId }, election: { id: e.id } },
          })) > 0
        : false,
      is_admin: isAdmin,
    }))
  );

  return await OPS_Success({
    ...ops_base,
    status: 'COMPLETED',
    message: 'Elections retrieved.',
    data: { elections: mapped, count: mapped.length },
  });
}