// src/services/organization/get_detail/index.ts
import { AppDataSource } from "../../../config/database";
import { Organization } from "../../../entities/Organization";
import { OrgMembers } from "../../../entities/OrgMembers";
import { OPS_Success, OPS_Error } from "../../../lib/ops/ops.factory";

export async function GetOrgDetail_Operation(params: { orgId: string; userId: string; network: any }) {
  const started_at = Date.now();
  const org = await AppDataSource.getRepository(Organization).findOneBy({ id: params.orgId });
  if (!org) {
    return await OPS_Error({ event: "GET_ORG_DETAIL", source: "GetOrgDetail_Operation", actor_type: "VOTER", actor_id: params.userId, started_at, network: params.network, auth: { factors_used: ["JWT"], confidence: 1.0, mfa_verified: false }, classification: "INTERNAL", integrity_class: "STANDARD", status: "OPERATION_FAILURE", message: "Organization not found.", error_code: "NOT_FOUND", error_category: "VALIDATION", retryable: false });
  }

  const ops_base = { event: "GET_ORG_DETAIL", source: "GetOrgDetail_Operation", actor_type: "VOTER" as const, actor_id: params.userId, started_at, network: params.network, auth: { factors_used: ["JWT"], confidence: 1.0, mfa_verified: false }, classification: "INTERNAL" as const, integrity_class: "STANDARD" as const };

  if (org.visibility === "public") {
    return await OPS_Success({ ...ops_base, status: "COMPLETED", message: "Organization detail.", data: org });
  }

  // Private org — check membership before revealing anything beyond
  // what search already showed. This is the "evidence" you mentioned:
  // a non-member sees enough to know it's real and how to request access,
  // not its internals.
  const membership = await AppDataSource.getRepository(OrgMembers).findOneBy({ org: { id: org.id }, user: { id: params.userId } });
  if (!membership || membership.status !== "active") {
    return await OPS_Success({
      ...ops_base, status: "COMPLETED", message: "Limited detail — private organization.",
      data: { id: org.id, name: org.name, sector: org.sector, visibility: "private", is_member: false, join_hint: "This organization is private. Request an invite from an admin, or use an invite link if you have one." },
    });
  }

  return await OPS_Success({ ...ops_base, status: "COMPLETED", message: "Organization detail.", data: org });
}