// src/services/Election_management/helpers/election.status.ts
// Shared helpers for computing an election's EFFECTIVE status.
//
// The DB persists status transitions (draft -> published -> closed) but the
// system intentionally has no cron job: an election that passed its end_at
// while still "published" must be treated as closed everywhere that matters.
// This gives us consistent reads while keeping the persisted status lazy.

export type ElectionEffectiveStatus = 'draft' | 'published' | 'closed' | 'archived';

export function effectiveElectionStatus(election: {
  status: string;
  start_at: Date;
  end_at: Date;
}): ElectionEffectiveStatus {
  if (election.status === 'draft') return 'draft';
  if (election.status === 'archived') return 'archived';
  if (election.status === 'closed') return 'closed';
  if (election.status === 'published') {
    const now = new Date();
    if (now > new Date(election.end_at)) return 'closed';
    return 'published';
  }
  // Unknown stored status — treat anything published-like as published.
  return 'published';
}

export function isElectionClosed(election: {
  status: string;
  start_at: Date;
  end_at: Date;
}): boolean {
  return effectiveElectionStatus(election) === 'closed';
}

/**
 * Lazily persist the closed state when an election has expired on disk.
 * Returns the (possibly updated) election so callers keep one source of truth.
 */
export async function finalizeElectionIfExpired(
  repo: any,
  election: { status: string; start_at: Date; end_at: Date } & Record<string, any>
) {
  if (election.status === 'published' && new Date() > new Date(election.end_at)) {
    election.status = 'closed';
    await repo.save(election);
  }
  return election;
}