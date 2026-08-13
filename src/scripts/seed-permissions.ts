// src/scripts/seed-permissions.ts
import { AppDataSource } from "../config/database";
import { RolePermission } from "../entities/RolePermission";

const MATRIX: { role: string; resource: string; action: string; effect?: "ALLOW" | "DENY" }[] = [

  // ── ACCOUNT_ACCESS[PART] ── read-only, pre-full-verification
  { role: "ACCOUNT_ACCESS[PART]", resource: "app", action: "explore", effect: "ALLOW" },
  { role: "ACCOUNT_ACCESS[PART]", resource: "organization", action: "read_public", effect: "ALLOW" },

  // ── ACCOUNT_ACCESS[FULL] ── verified account, base tier
  { role: "ACCOUNT_ACCESS[FULL]", resource: "app", action: "explore", effect: "ALLOW" },
  { role: "ACCOUNT_ACCESS[FULL]", resource: "organization", action: "read_public", effect: "ALLOW" },
  { role: "ACCOUNT_ACCESS[FULL]", resource: "account.self", action: "read", effect: "ALLOW" },
  { role: "ACCOUNT_ACCESS[FULL]", resource: "org_membership", action: "apply", effect: "ALLOW" },
  { role: "ACCOUNT_ACCESS[FULL]", resource: "token", action: "renew", effect: "ALLOW" },
  { role: "ACCOUNT_ACCESS[FULL]", resource: "token", action: "request", effect: "ALLOW" },
  { role: "ACCOUNT_ACCESS[FULL]", resource: "organization", action: "create", effect: "ALLOW" },

  // ── VOTER_ACCESS_PASS[PART] ── admitted to one specific election
  { role: "VOTER_ACCESS_PASS[PART]", resource: "ballot", action: "read", effect: "ALLOW" },
  { role: "VOTER_ACCESS_PASS[PART]", resource: "ballot", action: "fill", effect: "ALLOW" },
  { role: "VOTER_ACCESS_PASS[PART]", resource: "election.result_certified", action: "read", effect: "ALLOW" },
  { role: "VOTER_ACCESS_PASS[PART]", resource: "election.tally_live", action: "read", effect: "DENY" },

  // ── VOTER_ACCESS_PASS[FULL] ── the actual vote-casting moment
  { role: "VOTER_ACCESS_PASS[FULL]", resource: "vote", action: "cast", effect: "ALLOW" },

  // ── SELF_ACCOUNT_ACCESS ── re-auth'd, mutating own account
  { role: "SELF_ACCOUNT_ACCESS", resource: "account.self", action: "update", effect: "ALLOW" },
  { role: "SELF_ACCOUNT_ACCESS", resource: "account.self", action: "delete", effect: "ALLOW" },

  // ── ORG_ACCESS[PART] ── org admin
  { role: "ORG_ACCESS[PART]", resource: "election", action: "create", effect: "ALLOW" },
  { role: "ORG_ACCESS[PART]", resource: "election", action: "publish", effect: "ALLOW" },
  { role: "ORG_ACCESS[PART]", resource: "org_membership", action: "verify_join_request", effect: "ALLOW" },
  { role: "ORG_ACCESS[PART]", resource: "election.tally_live", action: "read", effect: "ALLOW" },
  { role: "ORG_ACCESS[PART]", resource: "election.result_certified", action: "approve", effect: "ALLOW" },

  // ── ORG_ACCESS[FULL] ── owner/moderator tier — everything ORG_ACCESS[PART]
  // has, written out explicitly (no inheritance in the lookup), PLUS owner-only actions.
  { role: "ORG_ACCESS[FULL]", resource: "election", action: "create", effect: "ALLOW" },
  { role: "ORG_ACCESS[FULL]", resource: "election", action: "publish", effect: "ALLOW" },
  { role: "ORG_ACCESS[FULL]", resource: "org_membership", action: "verify_join_request", effect: "ALLOW" },
  { role: "ORG_ACCESS[FULL]", resource: "election.tally_live", action: "read", effect: "ALLOW" },
  { role: "ORG_ACCESS[FULL]", resource: "election.result_certified", action: "approve", effect: "ALLOW" },
  { role: "ORG_ACCESS[FULL]", resource: "organization", action: "delete", effect: "ALLOW" },
  { role: "ORG_ACCESS[FULL]", resource: "election", action: "update_metadata", effect: "ALLOW" },

  // ── SYSTEM_ADMIN ── platform oversight, not org-scoped
  { role: "SYSTEM_ADMIN", resource: "app", action: "explore", effect: "ALLOW" },
  { role: "SYSTEM_ADMIN", resource: "organization", action: "read_public", effect: "ALLOW" },
  { role: "SYSTEM_ADMIN", resource: "organization", action: "read_metrics", effect: "ALLOW" },
  { role: "SYSTEM_ADMIN", resource: "organization", action: "evict", effect: "ALLOW" },
  { role: "SYSTEM_ADMIN", resource: "organization", action: "verify_onboard", effect: "ALLOW" },

  // ── NO_ACCESS ── flagged/locked account — one narrow escape hatch
  { role: "NO_ACCESS", resource: "account", action: "recovery", effect: "ALLOW" },
];

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(RolePermission);

  for (const entry of MATRIX) {
    await repo.upsert(
      { ...entry, effect: entry.effect ?? "ALLOW" },
      ["role", "resource", "action"]
    );
  }

  console.log(`Seeded ${MATRIX.length} permission rows.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});