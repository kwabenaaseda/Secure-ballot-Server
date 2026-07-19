import { AppDataSource } from "../../../config/database";
import {
  AuditLog,
  AuditActorType,
  AuditClassification,
  AuditIntegrityClass,
  AuditOpsStatus,
} from "../../../entities/audit_log";
import {
  Service_Success_Handler,
  Service_Error_Handler,
} from "../../../types/Response_handler";
import { buildIntegrityProof } from "./build.integrity";

type AnyHandler = Service_Success_Handler | Service_Error_Handler;

// ─── WRITE AUDIT LOG ──────────────────────────────────────────────────────────
// Owns the full transaction for every audit write:
//
//   BEGIN
//     pg_advisory_xact_lock        ← serialises chain reads
//     SELECT tail of chain         ← inside buildIntegrityProof
//     compute entry_hash + chain_hash
//     INSERT audit row             ← BIGSERIAL assigns sequence_number
//   COMMIT                         ← lock releases
//
// The queryRunner is passed into buildIntegrityProof so the advisory lock
// and the chain-tail SELECT happen inside the same transaction as the INSERT.
// If any step throws, the transaction rolls back and no partial entry is written.

export async function writeAuditLog(
  success: Service_Success_Handler | null,
  error:   Service_Error_Handler   | null
): Promise<void> {

  const handler = (success ?? error) as AnyHandler;
  if (!handler) return;

  const { _OPS_META: m, _OPS_SECURITY: s } = handler;

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // ── Recompute integrity proof inside the transaction ─────────────────────
    // buildIntegrityProof receives the queryRunner so it can:
    //   1. Acquire the advisory lock (within this transaction)
    //   2. SELECT the chain tail safely
    //   3. Return entry_hash + chain_hash
    // The sequence_number is NOT in the proof yet — BIGSERIAL assigns it below.
    const integrity = await buildIntegrityProof(
      m,
      s,
      handler.success,
      handler._OPS_STATUS,
      handler._OPS_MESSAGE,
      queryRunner       // ← transaction context
    );

    // ── Build the entity ─────────────────────────────────────────────────────
    const entry = new AuditLog();

    // Backward-compat columns
    entry.action    = m._event;
    entry.target_id = m._election_id ?? null;
    entry.metadata  = null;

    // OPS Meta
    entry.event           = m._event;
    entry.event_id        = m._event_id;
    entry.source          = m._source;
    entry.correlation_id  = m._correlation_id;
    entry.session_id      = m._session_id;
    entry.duration_ms     = m._duration_ms;
    entry.actor_type      = m._actor_type as AuditActorType;
    entry.actor_id        = m._actor_id;
    entry.election_id     = m._election_id ?? null;
    entry.org_id          = m._org_id      ?? null;
    entry.node_id         = m._node_id;
    entry.region          = m._region;
    entry.version         = m._version;
    entry.event_timestamp = new Date(m._timestamp);

    // Security Audit
    entry.classification          = s._classification  as AuditClassification;
    entry.integrity_class         = s._integrity_class as AuditIntegrityClass;
    entry.threat_signals          = s._threat_signals;
    entry.threat_score            = s._threat_score;
    entry.auth_factors_used       = s._auth_factors_used;
    entry.auth_confidence         = s._auth_confidence;
    entry.mfa_verified            = s._mfa_verified;
    entry.ip_hash                 = s._ip_hash;
    entry.device_fingerprint_hash = s._device_fingerprint_hash;
    entry.user_agent_class        = s._user_agent_class;

    // Integrity Proof (sequence_number excluded — BIGSERIAL sets it)
    entry.entry_hash     = integrity._entry_hash;
    entry.chain_hash     = integrity._chain_hash;
    entry.signed_by      = integrity._signed_by;
    entry.signature      = integrity._signature;
    entry.log_segment_id = integrity._log_segment_id!;

    // Operation result
    entry.success     = handler.success;
    entry.ops_status  = handler._OPS_STATUS as AuditOpsStatus;
    entry.ops_message = handler._OPS_MESSAGE;

    if (!handler.success) {
      const e = (handler as Service_Error_Handler)._OPS_ERROR;
      entry.error_code     = e.code;
      entry.error_category = e.category;
      entry.retryable      = e.retryable;
    } else {
      entry.error_code     = null;
      entry.error_category = null;
      entry.retryable      = null;
    }

    // ── INSERT (never save — INSERT only enforces append-only at ORM layer) ──
    // queryRunner.manager.insert returns the generated identifiers including
    // the BIGSERIAL sequence_number assigned by Postgres.
    const result = await queryRunner.manager
      .getRepository(AuditLog)
      .insert(entry);

    // Commit — this also releases the advisory lock
    await queryRunner.commitTransaction();

    // Log the assigned sequence number for observability
    const assignedSequence = result.generatedMaps?.[0]?.sequence_number;
    if (assignedSequence) {
      console.debug(
        `[AUDIT] ${m._event} #${assignedSequence} chain=${integrity._chain_hash.slice(0, 12)}...`
      );
    }

  } catch (err) {
    await queryRunner.rollbackTransaction();
    // Re-throw so ops.factory.ts catch handler can log it
    throw err;
  } finally {
    // Always release the queryRunner back to the connection pool
    await queryRunner.release();
  }
}