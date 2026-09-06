// src/services/Election_management/get_results/index.ts
// GET /election/:electionId/results — the result AGGREGATOR.
//
// Compiles per-category candidate tallies with percentages, total votes and
// turnout. Admins/moderators may read live tallies at any time (vote
// compilation); voters only see results AFTER the admin releases them.

import { AppDataSource } from '../../../config/database';
import { Election } from '../../../entities/Election';
import { Candidate } from '../../../entities/Candidates';
import { VoteTally } from '../../../entities/Vote_tally';
import { VoteRecord } from '../../../entities/Vote_record';
import { OrgMembers } from '../../../entities/OrgMembers';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { NetworkContext } from '../../../lib/ops/ops.types';
import { effectiveElectionStatus, finalizeElectionIfExpired } from '../helpers/election.status';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function GetElectionResults_Operation(params: {
  electionId: string;
  userId: string;
  network: NetworkContext;
}) {
  const started_at = Date.now();
  const ops_base = {
    event: 'GET_ELECTION_RESULTS',
    source: 'GetElectionResults_Operation',
    actor_type: 'VOTER' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
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

  const effective = effectiveElectionStatus(election);
  if (effective === 'draft') {
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: 'Results are unavailable before the election starts.',
      error_code: 'ELECTION_NOT_STARTED',
      error_category: 'VALIDATION',
      retryable: false,
    });
  }

  const membership = await AppDataSource.getRepository(OrgMembers).findOne({
    where: { org: { id: election.org.id }, user: { id: params.userId } },
  });
  const isAdmin =
    !!membership && membership.status === 'active' && ['admin', 'moderator'].includes(membership.role);

  // Voters cannot see unreleased tallies.
  if (!isAdmin && election.results_status !== 'released') {
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: 'Results have not been released yet.',
      error_code: 'RESULTS_NOT_RELEASED',
      error_category: 'AUTH',
      retryable: false,
    });
  }

  const [candidates, tallies] = await Promise.all([
    AppDataSource.getRepository(Candidate).find({
      where: { election: { id: election.id } },
      order: { category: 'ASC', fullname: 'ASC' },
    }),
    AppDataSource.getRepository(VoteTally).find({
      where: { election_id: election.id },
    }),
  ]);

  const tallyByCandidate = new Map<string, number>();
  let totalVotes = 0;
  for (const t of tallies) {
    tallyByCandidate.set(t.candidate_id, t.vote_count);
    totalVotes += t.vote_count;
  }

  // Group by category preserving order, then rank within each category.
  const categoryNames = Array.from(new Set(candidates.map((c) => c.category)));
  const categories = categoryNames.map((category) => {
    const catCandidates = candidates
      .filter((c) => c.category === category)
      .map((c) => ({
        id: c.id,
        fullname: c.fullname,
        votes: tallyByCandidate.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.votes - a.votes); // most votes first
    const categoryTotal = catCandidates.reduce((sum, c) => sum + c.votes, 0);

    // Competition ranking (1st, 2nd, 2nd, 4th…): tied vote counts share a
    // rank and the next rank is skipped.
    let lastVotes: number | null = null;
    let lastRank = 0;
    const ranked = catCandidates.map((c, i) => {
      const rank = c.votes === lastVotes ? lastRank : i + 1;
      lastVotes = c.votes;
      lastRank = rank;
      return {
        ...c,
        rank,
        is_winner: rank === 1 && c.votes > 0,
        percentage: categoryTotal > 0 ? round1((c.votes / categoryTotal) * 100) : 0,
      };
    });

    return {
      category,
      total: categoryTotal,
      winner: ranked.find((c) => c.is_winner)?.fullname ?? null,
      candidates: ranked,
    };
  });

  // Turnout vs eligible voters.
  const turnout = await AppDataSource.getRepository(VoteRecord).count({
    where: { election: { id: election.id } },
  });
  const activeMembers =
    election.is_public && !isAdmin
      ? null
      : await AppDataSource.getRepository(OrgMembers).count({
          where: { org: { id: election.org.id }, status: 'active' },
        });

  return await OPS_Success({
    ...ops_base,
    status: 'COMPLETED',
    message: 'Election results.',
    data: {
      election_id: election.id,
      election_name: election.name,
      status: election.status,
      results_status: election.results_status,
      results_released_at: election.results_released_at,
      end_at: election.end_at,
      total_votes: totalVotes,
      registered_voters: activeMembers,
      turnout,
      turnout_pct: activeMembers && activeMembers > 0 ? round1((turnout / activeMembers) * 100) : null,
      categories,
    },
  });
}