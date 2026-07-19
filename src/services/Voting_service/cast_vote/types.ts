import { NetworkContext, AuthContext } from "../../../lib/ops/ops.types";

export interface CastVotePayload {
  election_id: string;
  candidate_id: string;
  voter_id: string;
  network: NetworkContext;
  auth: AuthContext;
}