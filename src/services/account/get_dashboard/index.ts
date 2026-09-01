// src/services/account/get_dashboard/index.ts
import { AppDataSource } from '../../../config/database';
import { OrgMembers } from '../../../entities/OrgMembers';
import { Organization } from '../../../entities/Organization';
import { Election } from '../../../entities/Election';
import Operations_Manager, { Authorize } from '../../../utils/ops.manager';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { NetworkContext } from '../../../lib/ops/ops.types';
import { User } from '../../../entities/User';
import { VoteRecord } from '../../../entities/Vote_record';
import { In } from 'typeorm';

export async function GetDashboard_Operation(params: { userId: string; network: NetworkContext }) {
  const started_at = Date.now();
  const ops_base = {
    event: 'GET_DASHBOARD',
    source: 'GetDashboard_Operation',
    actor_type: 'VOTER' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'STANDARD' as const,
  };

  const ops = await Operations_Manager({ user_id: params.userId, location: 'domestic' });
  if (ops === false || !Authorize(ops.role, 'app', 'explore')) {
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: 'Not authorized.',
      error_code: 'FORBIDDEN',
      error_category: 'AUTH',
      retryable: false,
    });
  }
  // Find user
  const user = await AppDataSource.getRepository(User).findOneBy({ id: params.userId });
  if (!user) {
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: 'User not found.',
      error_code: 'USER_NOT_FOUND',
      error_category: 'VALIDATION',
      retryable: false,
    });
  }
  // Left column — orgs the user belongs to (member, not owner)
  const memberships = await AppDataSource.getRepository(OrgMembers).find({
    where: { user: { id: params.userId } },
    relations: ['org'],
  });

  // Right column — orgs the user created/administers
  const ownedOrgs = await AppDataSource.getRepository(Organization).find({
    where: { primary_admin: user },
  });

  // Ongoing elections — across every org the user is a member of AND owns.
  const orgIds = [...new Set([
    ...memberships.map((m) => m.org.id),
    ...ownedOrgs.map((o) => o.id),
  ])];
  const ongoingElections = orgIds.length ? await El(orgIds) : [];

  const voteRepo = AppDataSource.getRepository(VoteRecord);
  const votesCast = await voteRepo.count({
    where: { user: { id: params.userId } },
  });

  const organizations = [
    ...memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      sector: m.org.sector,
      visibility: m.org.visibility,
      status: m.org.status,
      membership_role: m.role,
      membership_status: m.status,
    })),
    // Owned orgs that aren't already in the memberships list.
    ...ownedOrgs
      .filter((o) => !memberships.some((m) => m.org.id === o.id))
      .map((o) => ({
        id: o.id,
        name: o.name,
        sector: o.sector,
        visibility: o.visibility,
        status: o.status,
        membership_role: 'admin' as const,
        membership_status: 'active' as const,
      })),
  ];

  const elections = await Promise.all(
    ongoingElections.map(async (e) => ({
      id: e.id,
      name: e.name,
      org_id: e.org.id,
      org_name: e.org.name,
      status: e.status,
      start_at: e.start_at,
      end_at: e.end_at,
      has_voted:
        (await voteRepo.count({
          where: { user: { id: params.userId }, election: { id: e.id } },
        })) > 0,
    }))
  );

  return await OPS_Success({
    ...ops_base,
    status: 'COMPLETED',
    message: 'Dashboard data retrieved.',
    data: {
      organizations,
      elections,
      stats: {
        total_orgs: organizations.length,
        active_elections: elections.length,
        votes_cast: votesCast,
      },
    },
  });
}

async function El(orgIds: string[]) {
  /* const COLLECTION: Election[] = []
     orgIds.forEach(async el =>{
       
        let election = await AppDataSource.getRepository(Election).find({
        where: { org: { id: el }, status: "published" }, // adjust status value to match your Election entity's actual enum
        relations: ["org"],
      })
      COLLECTION.concat(election)
     })
     return COLLECTION */
  return await AppDataSource.getRepository(Election).find({
    where: { org: { id: In(orgIds) }, status: 'published' }, // adjust status value to match your Election entity's actual enum
    relations: ['org'],
  });
}
