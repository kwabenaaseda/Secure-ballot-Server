// This operation helps determine whether a client gets to execute a request or not.
import { User } from "../entities/User";
import { OrgMembers } from "../entities/OrgMembers";
import { Organization } from "../entities/Organization";
import { RolePermission } from "../entities/RolePermission";
import { AppDataSource } from "../config/database";
import { Log } from "./Logger";



type Effect = "ALLOW" | "DENY";

let PERMISSION_CACHE: Map<string, Effect> = new Map();

function permKey(role: ROLES, resource: string, action: string): string {
  return `${role}::${resource}::${action}`;
}

// Call once at server boot, and optionally on a timer/admin-triggered
// refresh if you want live-editable permissions without a restart.
export async function LoadPermissionCache(): Promise<void> {
  try {
    const rows = await AppDataSource.getRepository(RolePermission).find();
    PERMISSION_CACHE = new Map(
      rows.map(r => [permKey(r.role as ROLES, r.resource, r.action), r.effect])
    );
    Log.info("PermissionCache", `Loaded ${rows.length} permission rows.`, "BOOT");
  } catch (error) {
    Log.error("PermissionCache", String(error), "BOOT");
    // Fail closed: if the cache can't load, PERMISSION_CACHE stays empty,
    // and Authorize() below denies everything by default. Never fail open.
  }
}

// ── PEP: the actual gate. Default-deny — a missing row and an explicit
// DENY row both resolve to false. ──
export function Authorize(role: ROLES, resource: RESOURCE, action: ACTION): boolean {
  return PERMISSION_CACHE.get(permKey(role, resource, action)) === "ALLOW";
}

// ── Types derived FROM the entities, not hand-written parallel unions.
// If the entity's status columns ever change, this breaks at compile time
// instead of silently mismatching (this is what caused the earlier case-bug).
export interface user_profiler {
  username: string;
  verification_status: User['verification_status'];
  user_status: User['user_status'];
  org_role?: OrgMembers['role'];
  org_status?: OrgMembers['status'];
  org_verified_via?: OrgMembers['verified_via'];
}

export type ROLES =
  | "ACCOUNT_ACCESS[PART]" | "ACCOUNT_ACCESS[FULL]"
  | "VOTER_ACCESS_PASS[PART]" | "VOTER_ACCESS_PASS[FULL]"
  | "SELF_ACCOUNT_ACCESS"
  | "ORG_ACCESS[PART]" | "ORG_ACCESS[FULL]"
  | "SYSTEM_ADMIN" | "NO_ACCESS";

export type LOCATION = "domestic" | "organization" | "engineer" | "account" | "vote";
export type ORG_ROLE = "voter" | "admin" | "moderator"; // NOTE: "moderator" == owner tier
export type RESOURCE = 'account.self' | 'app' | 'ballot' | 'election' | 'election.result_certified' | 'election.tally_live' | 'org_membership' | 'organization' | 'token' | 'vote'
export type ACTION = 'apply' | 'approve' | 'cast' | 'create' | 'delete' | 'evict' | 'explore' |  'fill' | 'publish' | 'read' | 'read_metrics' | 'read_public' | 'recovery' | 'renew' |'request' |'update' |'update_metadata' |'verify_join_request'|'verify_onboard'


// ── PIP: gather the facts. Plain reads — no transaction needed, since
// nothing here writes and a read-only txn wouldn't make the later
// authorize+act sequence atomic anyway. This is also what removed the
// earlier connection leak: no queryRunner acquired, nothing to forget
// to release. ──
async function USER_PROFILE(
  payload: { user_id: string; org_id?: string }
): Promise<user_profiler | false> {
  const { user_id, org_id } = payload;
  try {
    const user = await AppDataSource.getRepository(User).findOneBy({ id: user_id });
    if (!user) return false;

    const base: user_profiler = {
      username: user.username,
      verification_status: user.verification_status,
      user_status: user.user_status,
    };

    if (!org_id) return base;

    const org = await AppDataSource.getRepository(Organization).findOneBy({ id: org_id });
    if (!org) return false;

    const member = await AppDataSource.getRepository(OrgMembers).findOneBy({ org, user });
    if (!member) return false;

    return {
      ...base,
      org_role: member.role,
      org_status: member.status,
      org_verified_via: member.verified_via,
    };
  } catch (error) {
    Log.error("UserProfile", String(error), "User_Profiling");
    return false;
  }
}

// ── Shared ladder: unverified -> account PART; org inactive -> account
// FULL/PART by verification tier; org active & verified -> the
// role-specific tier passed in (which may itself be "no_access"). ──
function org_tier_role(profile: user_profiler, active_role: ROLES): ROLES {
  const { verification_status, org_status } = profile;

  if (verification_status === "unverified") return "ACCOUNT_ACCESS[PART]";
  if (org_status !== "active") {
    return verification_status === "verified" ? "ACCOUNT_ACCESS[FULL]" : "ACCOUNT_ACCESS[PART]";
  }
  return active_role;
}

// tier -> org_role -> role, when org is active and user is verified.
// "moderator" is the OWNER tier in this schema.
// Owner tracks WITH account status: full when clean, half (PART) when under review.
// Admin is a threshold, not a slope: normal access when clean, NONE when under
// review — an admin under review shouldn't act on someone else's org at all.
const ORG_ROLE_MAP: Record<"yellow" | "green", Record<ORG_ROLE, ROLES>> = {
  yellow: { voter: "VOTER_ACCESS_PASS[PART]", admin: "NO_ACCESS",         moderator: "ORG_ACCESS[PART]" },
  green:  { voter: "VOTER_ACCESS_PASS[PART]", admin: "ORG_ACCESS[PART]",  moderator: "ORG_ACCESS[FULL]" },
};

export function AssignRole(profile: user_profiler, location: LOCATION): ROLES {
  const { user_status, verification_status, org_role } = profile;

  if (user_status === "red") return "NO_ACCESS";

  if (location === "domestic" || location === "account") {
    return verification_status === "verified" ? "ACCOUNT_ACCESS[FULL]" : "ACCOUNT_ACCESS[PART]";
  }

  if (location === "organization") {
    if (user_status !== "yellow" && user_status !== "green") return "NO_ACCESS";
    if (!org_role || !(org_role in ORG_ROLE_MAP.green)) return "NO_ACCESS";

    const active_role = ORG_ROLE_MAP[user_status][org_role as ORG_ROLE];
    return org_tier_role(profile, active_role);
  }

  // "engineer" and "vote" locations: not yet defined — falls to no_access.
  return "NO_ACCESS";
}

// ── PDP entry point ──
async function Operations_Manager(
  payload: { user_id: string; org_id?: string; location: LOCATION }
) {
  try {
    const profile = await USER_PROFILE(payload);
    if (!profile) return false;

    return {
      profile:profile,          // raw facts, for any ABAC check the caller still needs to run
      role: AssignRole(profile, payload.location),
      authorize:Authorize
    };
  } catch (error) {
    Log.error("Operations_Manager", String(error), "OPS_MANAGER");
    return false;
  }
}

export default Operations_Manager;