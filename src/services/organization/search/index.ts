// src/services/organization/search/index.ts
import { AppDataSource } from "../../../config/database";
import { Organization } from "../../../entities/Organization";
import { ILike } from "typeorm";
import { OPS_Success } from "../../../lib/ops/ops.factory";
import { NetworkContext } from "../../../lib/ops/ops.types";

export async function SearchOrganizations_Operation(params: { query: string; network: NetworkContext }) {
  const orgs = await AppDataSource.getRepository(Organization).find({
    where: { name: ILike(`%${params.query}%`) },
    take: 20,
  });

  // Public-safe fields ONLY, regardless of visibility — this is the list
  // view, never the detail view. A private org's mere existence being
  // searchable is fine; its internal data is not.
  return await OPS_Success({
    event: "SEARCH_ORGANIZATIONS", source: "SearchOrganizations_Operation",
    actor_type: "VOTER", actor_id: "search", started_at: Date.now(), network: params.network,
    auth: { factors_used: ["JWT"], confidence: 1.0, mfa_verified: false },
    classification: "INTERNAL", integrity_class: "STANDARD",
    status: "COMPLETED", message: "Search results.",
    data: orgs.map(o => ({ id: o.id, name: o.name, sector: o.sector, visibility: o.visibility, company_logo: o.company_logo })),
  });
}