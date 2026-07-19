import { NetworkContext, AuthContext } from "../../../lib/ops/ops.types";

export interface AddCandidatePayload {
  election_id: string;
  fullname: string;
  category: string;
  image?: string;
  summary?: string;
  manifesto?: string;
  nationality?: string;
  creator_id: string;         // must be active admin/moderator of election's org
  network: NetworkContext;
  auth: AuthContext;
}