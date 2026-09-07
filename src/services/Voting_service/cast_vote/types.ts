import { NetworkContext, AuthContext } from '../../../lib/ops/ops.types';

export interface VoteSelection {
  category: string;
  candidate_id: string;
}

export interface CastVotePayload {
  election_id: string;
  /**
   * One entry per category the voter selected. A single-category election is
   * just a selections array of length 1; a multi-category ballot carries one
   * selection for "President", one for "VP", etc. The server records the
   * whole ballot as a single participation (VoteRecord is unique per voter +
   * election) — this is what enforces "one ballot per election" and yields the
   * ALREADY_VOTED guard on any replay.
   */
  selections: VoteSelection[];
  voter_id: string;
  network: NetworkContext;
  auth: AuthContext;
  // Optional step-up token (biometric) — required when the voter has biometrics enrolled.
  step_up_token?: string;
}
