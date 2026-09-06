// src/services/Election_management/get_election/index.ts
// GET /election/:electionId — election detail + candidates + requesting user's
// vote state. Drafts are admin/moderator-only. Published/closed elections are
// visible to members (or non-members for public org public elections).

import { AppDataSource } from '../../../config/database';
import { Election } from '../../../entities/Election';
import { Candidate } from '../../../entities/Candidates';
import { OrgMembers } from '../../../entities/OrgMembers';
import { VoteRecord } from '../../../entities/Vote_record';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { NetworkContext } from '../../../lib/ops/ops.types';
import { effectiveElectionStatus, finalizeElectionIfExpired } from '../helpers/election.status';

export async function GetElection_Operation(params: {
  electionId: string;
  userId: string;
  network: NetworkContext;
}) {
  const started_at = Date.now();
  const ops_base = {
    event: 'GET_ELECTION_DETAIL',
    source: 'GetElection_Operation',
    actor_type: 'VOTER' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'STANDARD' as const,
    election_id: params.electionId,
  };

  const repo = AppDataSource.getRepository(Election);
  const election = await repo.findOne({
    where: { id: params.electionId },
    relations: ['org'],
  });
  if (!election) {
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: 'Election not found.',
      error_code: 'ELECTION_NOT_FOUND',
      error_category: 'VALIDATION',
      retryable: false,
    });
  }
  await finalizeElectionIfExpired(repo, election);

  const membership = await AppDataSource.getRepository(OrgMembers).findOne({
    where: { org: { id: election.org.id }, user: { id: params.userId } },
  });
  const isAdmin =
    !!membership && membership.status === 'active' && ['admin', 'moderator'].includes(membership.role);
  const isMember = !!membership && membership.status === 'active';

  const effective = effectiveElectionStatus(election);
  let canView = false;
  if (isAdmin) {
    canView = true;
  } else if (effective === 'draft') {
    canView = false;
  } else if (isMember) {
    canView = true;
  } else if (election.org.visibility === 'public' && election.is_public) {
    canView = true;
  }

  if (!canView) {
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: 'You do not have access to this election.',
      error_code: 'FORBIDDEN',
      error_category: 'AUTH',
      retryable: false,
    });
  }

  const candidates = await AppDataSource.getRepository(Candidate).find({
    where: { election: { id: election.id } },
    order: { category: 'ASC', fullname: 'ASC' },
  });

  // Candidate visibility: drafts are admin-only anyway (canView above), so for
  // voters this only applies to published/closed elections. Hide only
  // explicitly REJECTED candidates — legacy 'pending' rows (created before
  // admin-add approval) must still be visible, or voters would see an election
  // with "no candidates".
  const visibleCandidates = (isAdmin
    ? candidates
    : candidates.filter((c) => c.vetting_status !== 'rejected')
  ).map(
    (c) => ({
      id: c.id,
      fullname: c.fullname,
      category: c.category,
      image: c.image,
      summary: c.summary,
      manifesto: c.manifesto,
      nationality: c.nationality,
      vetting_status: isAdmin ? c.vetting_status : undefined,
    })
  );

  const hasVoted = isMember
    ? (await AppDataSource.getRepository(VoteRecord).count({
        where: { user: { id: params.userId }, election: { id: election.id } },
      })) > 0
    : false;

  return await OPS_Success({
    ...ops_base,
    status: 'COMPLETED',
    message: 'Election detail retrieved.',
    data: {
      election: {
        id: election.id,
        org_id: election.org.id,
        org_name: election.org.name,
        name: election.name,
        summary: election.summary,
        field: election.field,
        location: election.location,
        visibility: election.visibility,
        is_public: election.is_public,
        categories: election.categories ?? [],
        status: effective,
        results_status: election.results_status,
        start_at: election.start_at,
        end_at: election.end_at,
        registration_cutoff_at: election.registration_cutoff_at,
        created_at: election.created_at,
        has_voted: hasVoted,
        is_admin: isAdmin,
        is_member: isMember,
      },
      candidates: visibleCandidates,
    },
  });
}