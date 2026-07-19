import { NetworkContext, AuthContext } from "../../../lib/ops/ops.types";

export interface CreateOrganizationPayload {
  name: string;
  sector: string;
  email: string;
  company_logo?: string;
  visibility: "private" | "public";
  creator_id: string;       // authenticated user creating the org
  network: NetworkContext;
  auth: AuthContext;         // carried from the requester's existing session
}