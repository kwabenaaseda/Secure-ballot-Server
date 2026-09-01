// src/services/organization/get_detail/index.ts
import { AppDataSource } from '../../../config/database';
import { Organization } from '../../../entities/Organization';
import { OrgMembers } from '../../../entities/OrgMembers';
import { OrganizationAuth } from '../../../entities/Org_auth';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';

// Public-safe entity fields, shared between the public and member views.
// Deliberately excludes internal audit fields (reviewed_by, reviewed_at)
// and the primary_admin relation (a full User object must never leak).
function orgBase(o: Organization, authFields: Record<string, any>) {
  return {
    id: o.id,
    name: o.name,
    sector: o.sector,
    email: o.email,
    company_logo: o.company_logo,
    website: o.website,
    location: o.location,
    description: o.description,
    established_year: o.established_year,
    visibility: o.visibility,
    status: o.status,
    custom_fields: Array.isArray(authFields) ? authFields : [],
  };
}

export async function GetOrgDetail_Operation(params: {
  orgId: string;
  userId: string;
  network: any;
}) {
  const started_at = Date.now();
  const org = await AppDataSource.getRepository(Organization).findOneBy({ id: params.orgId });
  if (!org) {
    return await OPS_Error({
      event: 'GET_ORG_DETAIL',
      source: 'GetOrgDetail_Operation',
      actor_type: 'VOTER',
      actor_id: params.userId,
      started_at,
      network: params.network,
      auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
      classification: 'INTERNAL',
      integrity_class: 'STANDARD',
      status: 'OPERATION_FAILURE',
      message: 'Organization not found.',
      error_code: 'NOT_FOUND',
      error_category: 'VALIDATION',
      retryable: false,
    });
  }

  const ops_base = {
    event: 'GET_ORG_DETAIL',
    source: 'GetOrgDetail_Operation',
    actor_type: 'VOTER' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'STANDARD' as const,
  };

  const membership = await AppDataSource.getRepository(OrgMembers).findOneBy({
    org: { id: org.id },
    user: { id: params.userId },
  });

  const auth = await AppDataSource.getRepository(OrganizationAuth).findOneBy({
    org: { id: org.id },
  });

  const isMember = !!membership && membership.status === 'active';

  // Public org OR active member → full public-safe detail, plus the
  // requesting user's own membership so the client can render the right CTA.
  if (org.visibility === 'public' || isMember) {
    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'Organization detail.',
      data: {
        organization: {
          ...orgBase(org, auth?.custom_fields ?? []),
          is_member: isMember,
          membership: membership
            ? { role: membership.role, status: membership.status }
            : null,
        },
      },
    });
  }

  // Private org, non-active-member — enough to know it's real and how to
  // request access, not its internals.
  return await OPS_Success({
    ...ops_base,
    status: 'COMPLETED',
    message: 'Limited detail — private organization.',
    data: {
      organization: {
        ...orgBase(org, []),
        email: null,
        company_logo: null,
        website: null,
        location: null,
        description: null,
        established_year: null,
        is_member: false,
        membership: membership
          ? { role: membership.role, status: membership.status }
          : null,
        join_hint:
          'This organization is private. Request an invite from an admin, or use an invite link if you have one.',
      },
    },
  });
}
