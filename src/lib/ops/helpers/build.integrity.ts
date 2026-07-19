import { createHash, createHmac } from "crypto";
import { INTEGRITY_PROOF, OPS_META, SECURITY_AUDIT } from "../../../types/Response_handler";
import { AppDataSource } from "../../../config/database";
import { AuditLog } from "../../../entities/audit_log";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const SERVER_SIGNING_KEY = process.env.SERVER_SIGNING_KEY ?? "dev-signing-key-replace-in-prod";
const SERVER_KEY_ID      = process.env.SERVER_KEY_ID      ?? "key-dev-001";
const LOG_SEGMENT_PREFIX = process.env.LOG_SEGMENT_PREFIX ?? "seg";

// Genesis hash: the fixed, public chain anchor.
// Every auditor can verify the chain starts here.
// This value must never change once the system goes live.
const GENESIS_HASH = createHash("sha256")
  .update("SECUREVOTE_AUDIT_CHAIN_GENESIS_V1")
  .digest("hex");

// Advisory lock key: a stable 32-bit integer Postgres uses to identify
// this application's audit chain lock. hashtext() in Postgres maps a string
// to an integer — we use the same string here for documentation clarity.
// In the DB query below this is passed as a hardcoded integer literal.
// Value: hashtext('securevote_audit_chain_lock') = 1874399722 (computed once)
const AUDIT_CHAIN_LOCK_KEY = 1874399722;

// ─── CANONICAL JSON ───────────────────────────────────────────────────────────
// JSON.stringify key ordering is not guaranteed across engines.
// Sorting keys ensures the same logical object always produces the same hash.

function canonicalJSON(obj: object): string {
  const sortedKeys = Object.keys(obj).sort();
  return JSON.stringify(obj, sortedKeys);
}

// ─── GET PREVIOUS CHAIN HASH (with advisory lock) ─────────────────────────────
// This function MUST be called inside a transaction — the advisory lock
// acquired here is transaction-scoped and releases automatically on
// COMMIT or ROLLBACK, so it cannot be orphaned.
//
// Flow:
//   1. Acquire pg_advisory_xact_lock — blocks any other writer trying
//      to acquire the same lock. Readers are unaffected.
//   2. SELECT the latest chain_hash and sequence_number.
//   3. Caller computes chain hash and inserts the new row.
//   4. Transaction commits → lock releases → next writer unblocks.
//
// The lock is in-memory in Postgres (no row contention), extremely fast
// to acquire under low concurrency, and queues cleanly under high concurrency.

async function getChainTailInTransaction(
  queryRunner: any
): Promise<{ hash: string; sequence: number }> {

  // Acquire transaction-scoped advisory lock.
  // This call blocks until no other session holds the lock.
  await queryRunner.query(
    `SELECT pg_advisory_xact_lock($1)`,
    [AUDIT_CHAIN_LOCK_KEY]
  );

  // Now we are the only writer. Safe to read the tail.
  const rows: Array<{ chain_hash: string; sequence_number: string }> =
    await queryRunner.query(
      `SELECT chain_hash, sequence_number
       FROM audit_log
       ORDER BY sequence_number DESC
       LIMIT 1`
    );

  if (!rows || rows.length === 0) {
    // Empty table — first ever entry chains to genesis
    return { hash: GENESIS_HASH, sequence: 0 };
  }

  return {
    hash:     rows[0].chain_hash,
    sequence: parseInt(rows[0].sequence_number, 10),
    // parseInt because Postgres returns BIGINT as string in node-postgres
  };
}

// ─── BUILD INTEGRITY PROOF ────────────────────────────────────────────────────
// Returns the computed INTEGRITY_PROOF for this log entry.
// Does NOT write to the database — that is write.audit.ts's job.
// The queryRunner is passed in from write.audit.ts which owns the transaction.

export async function buildIntegrityProof(
  meta: OPS_META,
  security: SECURITY_AUDIT,
  success: boolean,
  status: string,
  message: string,
  queryRunner?: any   // injected by write.audit.ts when inside a transaction
): Promise<INTEGRITY_PROOF> {

  // ── Entry content: everything we're committing to ──────────────────────────
  // This is the canonical representation of this audit entry.
  // Any field added here must also be added to AuditLog entity — they
  // must stay in sync or chain verification will fail on replay.
  const entry_content = {
    event:           meta._event,
    event_id:        meta._event_id,
    actor_id:        meta._actor_id,         // already hashed by buildMeta
    actor_type:      meta._actor_type,
    timestamp:       meta._timestamp,
    correlation_id:  meta._correlation_id,
    success,
    status,
    message,
    threat_score:    security._threat_score,
    threat_signals:  [...security._threat_signals].sort(), // sort for determinism
    integrity_class: security._integrity_class,
    classification:  security._classification,
    node_id:         meta._node_id,
    version:         meta._version,
  };

  const entry_hash = createHash("sha256")
    .update(canonicalJSON(entry_content))
    .digest("hex");

  // ── Chain: bind this entry to the previous one ─────────────────────────────
  let prev_chain_hash: string;
  let prev_sequence: number;

  if (queryRunner) {
    // Inside a transaction — use the advisory lock path
    const tail = await getChainTailInTransaction(queryRunner);
    prev_chain_hash = tail.hash;
    prev_sequence   = tail.sequence;
  } else {
    // Fallback: called outside a transaction (e.g. testing, dry-run).
    // No lock — not safe for production concurrent writes.
    // write.audit.ts always passes a queryRunner, so this path
    // should only be hit in unit tests.
    const repo   = AppDataSource.getRepository(AuditLog);
    const latest = await repo
      .createQueryBuilder('a')
      .select(['a.chain_hash', 'a.sequence_number'])
      .orderBy('a.sequence_number', 'DESC')
      .limit(1)
      .getOne();

    prev_chain_hash = latest?.chain_hash ?? GENESIS_HASH;
    prev_sequence   = latest?.sequence_number ?? 0;
  }

  const chain_hash = createHash("sha256")
    .update(entry_hash + prev_chain_hash)
    .digest("hex");

  // ── Server signature ───────────────────────────────────────────────────────
  // Signs the entry_hash — proves this entry was produced by this server.
  // In production: replace with Ed25519 signing via HSM or KMS.
  const signature = createHmac("sha256", SERVER_SIGNING_KEY)
    .update(entry_hash)
    .digest("hex");

  // ── Log segment ───────────────────────────────────────────────────────────
  // Groups entries by UTC day. Used for segment-level integrity audits
  // (verify all entries in a day form an unbroken chain).
  const today          = new Date().toISOString().slice(0, 10);
  const log_segment_id = `${LOG_SEGMENT_PREFIX}-${today}`;

  // sequence_number is NOT set here — BIGSERIAL assigns it on INSERT.
  // The _sequence_number field will be populated by write.audit.ts
  // after the INSERT returns the generated value.
  return {
    _entry_hash:     entry_hash,
    _chain_hash:     chain_hash,
    _signed_by:      SERVER_KEY_ID,
    _signature:      signature,
    _log_segment_id: log_segment_id,
    // _sequence_number: assigned post-insert by write.audit.ts
  };
}