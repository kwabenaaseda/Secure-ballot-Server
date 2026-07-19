import { NetworkContext, AuthContext } from "../../../lib/ops/ops.types";

export interface CreateElectionPayload {
  org_id: string;
  name: string;
  summary?: string;
  field?: string;
  location?: string;
  visibility: "private" | "public";
  is_public: boolean;
  categories: string[];        // single category tonight: e.g. ["President"]
  start_at: string;            // ISO string
  end_at: string;
  registration_cutoff_at?: string;
  creator_id: string;          // must be an active admin/moderator of org_id
  network: NetworkContext;
  auth: AuthContext;
}