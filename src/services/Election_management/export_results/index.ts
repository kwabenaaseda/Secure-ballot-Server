// src/services/Election_management/export_results/index.ts
// GET /election/:electionId/results/export — CSV export of the compiled result
// aggregator for downstream reporting. Same access rules as results read.

import { GetElectionResults_Operation } from '../get_results';
import { NetworkContext } from '../../../lib/ops/ops.types';
import { OPS_Success } from '../../../lib/ops/ops.factory';

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function ExportElectionResults_Operation(params: {
  electionId: string;
  userId: string;
  network: NetworkContext;
}) {
  const result = await GetElectionResults_Operation(params);
  if (!result.success) return result;

  const data = result._OPS_DATA as any;
  const released = data.results_status === 'released';
  const ordinal = (n: number): string =>
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;

  const rows: string[] = [
    'SecureBallot — Certified Results Export',
    `Election,${csvEscape(data.election_name ?? '')}`,
    `Status,${released ? 'RELEASED — CERTIFIED FINAL' : 'LIVE — PROVISIONAL (not yet certified)'}`,
    `Results released at,${data.results_released_at ?? '—'}`,
    `Exported at,${new Date().toISOString()}`,
    `Total votes,${data.total_votes ?? 0}`,
    `Turnout,${data.turnout ?? 0}${data.registered_voters != null ? ` of ${data.registered_voters} eligible` : ''}${data.turnout_pct != null ? ` (${data.turnout_pct}%)` : ''}`,
    '',
    ['place', 'rank', 'category', 'candidate', 'votes', 'share_percent', 'outcome'].map(csvEscape).join(','),
  ];
  for (const cat of data.categories ?? []) {
    for (const c of cat.candidates ?? []) {
      let outcome = '';
      if (cat.tie && c.is_winner) outcome = `TIE — ${ordinal(c.rank)}`;
      else if (c.tied) outcome = `TIE — ${ordinal(c.rank)}`;
      else if (c.is_winner) outcome = 'WINNER';
      rows.push(
        [
          cat.tie && c.is_winner ? `Tie — ${ordinal(c.rank)}` : ordinal(c.rank ?? 0),
          String(c.rank ?? ''),
          cat.category,
          c.fullname,
          String(c.votes),
          String(c.percentage),
          outcome,
        ]
          .map(csvEscape)
          .join(',')
      );
    }
    // One clear result line per category, right under its ranked rows.
    if (cat.tie) {
      rows.push(
        [`Tie — ${cat.category}`, csvEscape((cat.tied_names ?? []).join('; '))].join(',')
      );
    } else if (cat.winner) {
      rows.push([`Winner — ${cat.category}`, csvEscape(cat.winner)].join(','));
    }
    rows.push('');
  }
  rows.push(
    ['', '', '', 'TOTAL', String(data.total_votes ?? 0), '', ''].join(','),
    ['', '', '', 'TURNOUT', String(data.turnout ?? 0), data.turnout_pct != null ? String(data.turnout_pct) : '', ''].join(',')
  );

  const slug =
    (data.election_name ?? 'election')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'election';
  const filename = `${slug}-results-${new Date().toISOString().slice(0, 10)}.csv`;

  return await OPS_Success({
    event: 'EXPORT_ELECTION_RESULTS',
    source: 'ExportElectionResults_Operation',
    actor_type: 'VOTER' as const,
    actor_id: params.userId,
    started_at: Date.now(),
    network: params.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
    election_id: params.electionId,
    status: 'COMPLETED',
    message: 'Results exported.',
    data: {
      filename,
      csv: rows.join('\n'),
      summary: {
        election_id: data.election_id,
        election_name: data.election_name,
        total_votes: data.total_votes,
        turnout: data.turnout,
        turnout_pct: data.turnout_pct,
        results_status: data.results_status,
        results_released_at: data.results_released_at,
      },
    },
  });
}