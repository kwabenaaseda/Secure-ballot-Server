import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

// ─── ENUMS ────────────────────────────────────────────────────────────────────
// Mirrored from Response_handler.ts — duplicated here so TypeORM can use them
// as native Postgres enum columns without importing from the types layer.

export enum AuditActorType {
  VOTER      = 'VOTER',
  ORG_ADMIN  = 'ORG_ADMIN',
  SYSTEM     = 'SYSTEM',
  SCHEDULER  = 'SCHEDULER',
  KEYHOLDER  = 'KEYHOLDER',
  AUDITOR    = 'AUDITOR',
}

export enum AuditClassification {
  PUBLIC     = 'PUBLIC',
  INTERNAL   = 'INTERNAL',
  RESTRICTED = 'RESTRICTED',
  SEALED     = 'SEALED',
}

export enum AuditIntegrityClass {
  STANDARD    = 'STANDARD',
  SENSITIVE   = 'SENSITIVE',
  IMMUTABLE   = 'IMMUTABLE',
  CEREMONIAL  = 'CEREMONIAL',
}

export enum AuditOpsStatus {
  COMPLETED          = 'COMPLETED',
  PENDING            = 'PENDING',
  OPERATION_FAILURE  = 'OPERATION_FAILURE',
  SYSTEM_FAILURE     = 'SYSTEM_FAILURE',
}

// ─── ENTITY ───────────────────────────────────────────────────────────────────

@Entity('audit_log')
@Index(['sequence_number'])                    // fast chain traversal
@Index(['election_id'])                        // fast per-election audit pull
@Index(['actor_id', 'event'])                  // fast per-actor event history
@Index(['log_segment_id'])                     // fast segment-level integrity checks
@Index(['created_at'])                         // fast time-range queries
export class AuditLog {

  // ── PRIMARY KEY ─────────────────────────────────────────────────────────────

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── PRESERVED FROM ORIGINAL (migrated, not dropped) ─────────────────────────

  @Column({ type: 'varchar', name: 'action' })
  action: string;                              // kept for backward compat — maps to `event`

  @Column({ type: 'uuid', nullable: true, name: 'target_id' })
  target_id: string | null;                    // ID of affected resource — preserved

  @Column({ type: 'jsonb', nullable: true, name: 'metadata' })
  metadata: Record<string, any> | null;        // legacy catch-all — preserved, phased out over time

  // ── OPS META ────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', name: 'event' })
  event: string;                               // e.g. "SIGNUP", "VOTE_SUBMIT"

  @Column({ type: 'uuid', name: 'event_id' })
  event_id: string;                            // unique per event instance

  @Column({ type: 'varchar', name: 'source' })
  source: string;                              // e.g. "Signup_Operation"

  @Column({ type: 'uuid', name: 'correlation_id' })
  @Index()
  correlation_id: string;                      // traces full request chain

  @Column({ type: 'varchar', name: 'session_id' })
  session_id: string;                          // session this action belongs to

  @Column({ type: 'integer', name: 'duration_ms' })
  duration_ms: number;                         // operation execution time

  // Actor — decoupled from User FK so SYSTEM/SCHEDULER/KEYHOLDER events work
  @Column({ type: 'enum', enum: AuditActorType, name: 'actor_type' })
  actor_type: AuditActorType;

  @Column({ type: 'varchar', name: 'actor_id' })
  @Index()
  actor_id: string;                            // hashed — never raw user UUID

  @Column({ type: 'uuid', nullable: true, name: 'election_id' })
  election_id: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'org_id' })
  org_id: string | null;

  // Environment
  @Column({ type: 'varchar', name: 'node_id' })
  node_id: string;

  @Column({ type: 'varchar', name: 'region' })
  region: string;

  @Column({ type: 'varchar', name: 'version' })
  version: string;

  // ── SECURITY AUDIT ──────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: AuditClassification, name: 'classification' })
  classification: AuditClassification;

  @Column({ type: 'enum', enum: AuditIntegrityClass, name: 'integrity_class' })
  integrity_class: AuditIntegrityClass;

  @Column({ type: 'varchar', array: true, name: 'threat_signals' })
  threat_signals: string[];                    // THREAT_SIGNAL[]

  @Column({ type: 'integer', name: 'threat_score' })
  threat_score: number;                        // 0–100

  @Column({ type: 'varchar', array: true, name: 'auth_factors_used' })
  auth_factors_used: string[];                 // e.g. ["PASSWORD","OTP"]

  @Column({ type: 'float', name: 'auth_confidence' })
  auth_confidence: number;                     // 0.0–1.0

  @Column({ type: 'boolean', name: 'mfa_verified' })
  mfa_verified: boolean;

  @Column({ type: 'varchar', name: 'ip_hash' })
  ip_hash: string;                             // hashed — never raw IP

  @Column({ type: 'varchar', name: 'device_fingerprint_hash', nullable: true })
  device_fingerprint_hash: string | null;

  @Column({ type: 'varchar', name: 'user_agent_class' })
  user_agent_class: string;

  // ── INTEGRITY PROOF ─────────────────────────────────────────────────────────

  @Column({ type: 'bigint', name: 'sequence_number', generated:"increment" })
  sequence_number: number;                     // global append-only counter

  @Column({ type: 'varchar', name: 'entry_hash' })
  entry_hash: string;                          // SHA256(canonical entry content)

  @Column({ type: 'varchar', name: 'chain_hash' })
  chain_hash: string;                          // SHA256(entry_hash + prev_chain_hash)

  @Column({ type: 'varchar', name: 'signed_by' })
  signed_by: string;                           // server key ID

  @Column({ type: 'varchar', name: 'signature' })
  signature: string;                           // HMAC-SHA256 over entry_hash

  @Column({ type: 'varchar', name: 'log_segment_id' })
  log_segment_id: string;                      // e.g. "seg-2026-07-15"

  // ── OPERATION RESULT ────────────────────────────────────────────────────────

  @Column({ type: 'boolean', name: 'success' })
  success: boolean;

  @Column({ type: 'enum', enum: AuditOpsStatus, name: 'ops_status' })
  ops_status: AuditOpsStatus;

  @Column({ type: 'varchar', name: 'ops_message' })
  ops_message: string;

  // Error fields — nullable, populated only on failure
  @Column({ type: 'varchar', nullable: true, name: 'error_code' })
  error_code: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'error_category' })
  error_category: string | null;

  @Column({ type: 'boolean', nullable: true, name: 'retryable' })
  retryable: boolean | null;

  // ── TIMESTAMP ───────────────────────────────────────────────────────────────
  // CreateDateColumn is fine here — it's set by Postgres on INSERT.
  // We also store the precise operation timestamp from OPS_META separately
  // because created_at reflects DB write time, not operation start time.

  @Column({ type: 'timestamptz', name: 'event_timestamp' })
  event_timestamp: Date;                       // from OPS_META._timestamp

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;                            // DB write time — preserved
}