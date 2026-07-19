// ─── ENUMS ────────────────────────────────────────────────────────────────────

export type OPS_STATUS =
  | "COMPLETED"
  | "PENDING"
  | "OPERATION_FAILURE"
  | "SYSTEM_FAILURE";

export type SECURITY_CLASSIFICATION =
  | "PUBLIC"        // safe to log anywhere
  | "INTERNAL"      // internal systems only
  | "RESTRICTED"    // audit-only access
  | "SEALED";       // shadow system — no log content, only hash proof

export type INTEGRITY_CLASS =
  | "STANDARD"      // normal operations
  | "SENSITIVE"     // auth events, admin actions
  | "IMMUTABLE"     // vote submissions, shadow writes — append-only
  | "CEREMONIAL";   // key generation, tally operations

export type ACTOR_TYPE =
  | "VOTER"
  | "ORG_ADMIN"
  | "SYSTEM"
  | "SCHEDULER"
  | "KEYHOLDER"
  | "AUDITOR";

export type THREAT_SIGNAL =
  | "NONE"
  | "RATE_LIMIT_APPROACHED"
  | "RATE_LIMIT_EXCEEDED"
  | "UNUSUAL_TIMING"            // action too fast (bot) or too slow (abandoned)
  | "DEVICE_MISMATCH"           // different device from prior action in session
  | "NETWORK_MISMATCH"          // different IP range from prior action
  | "CREDENTIAL_ANOMALY"        // auth confidence drop
  | "REPEAT_ACTION"             // re-vote, re-auth in short window
  | "SEQUENCE_VIOLATION"        // action arrived out of expected protocol order
  | "CONCURRENT_SESSION";       // same identity active in two sessions

export type ERROR_CATEGORY =
  | "VALIDATION"
  | "AUTH"
  | "CRYPTO"
  | "DATABASE"
  | "NETWORK"
  | "SYSTEM";

// ─── OPS_META ─────────────────────────────────────────────────────────────────

export interface OPS_META {
  // operation identity
  _event: string;               // e.g. "SIGNUP", "VOTE_SUBMIT", "AUTH_VERIFY"
  _event_id: string;            // UUID — unique per event instance
  _source: string;              // service + method e.g. "AuthService.signup"
  _correlation_id: string;      // traces full request chain across services
  _session_id: string;          // session this action belongs to
  _timestamp: string;           // ISO 8601 with timezone
  _duration_ms: number;         // how long the operation took (ms)

  // actor
  _actor_type: ACTOR_TYPE;
  _actor_id: string;            // hashed — never raw user ID in logs
  _election_id?: string;        // if election-scoped
  _org_id?: string;             // if org-scoped

  // environment
  _node_id: string;             // which server instance processed this
  _region: string;              // deployment region
  _version: string;             // application version
}

// ─── SECURITY_AUDIT ───────────────────────────────────────────────────────────

export interface SECURITY_AUDIT {
  _classification: SECURITY_CLASSIFICATION;
  _integrity_class: INTEGRITY_CLASS;

  // threat signals observed during this operation
  _threat_signals: THREAT_SIGNAL[];
  _threat_score: number;        // 0–100 composite score

  // authentication state at time of action
  _auth_factors_used: string[]; // e.g. ["PASSWORD", "OTP", "BIOMETRIC"]
  _auth_confidence: number;     // 0.0–1.0; biometric confidence if applicable
  _mfa_verified: boolean;

  // network context (nothing raw — always hashed or classified)
  _ip_hash: string;
  _device_fingerprint_hash: string;
  _user_agent_class: string;    // "MOBILE_APP" | "DESKTOP_APP" | "BROWSER"

  // re-vote context (populated only on re-vote events)
  _vote_sequence?: number;
  _re_vote_window_remaining_ms?: number;
  _prior_vote_token?: string;   // token of superseded vote, never content
}

// ─── INTEGRITY_PROOF ──────────────────────────────────────────────────────────

export interface INTEGRITY_PROOF {
  _entry_hash: string;          // SHA3(canonical JSON of this entry's content)
  _chain_hash: string;          // SHA3(entry_hash + previous_chain_hash)
  _signed_by: string;           // server signing key ID
  _signature: string;           // server signature over _entry_hash
  _sequence_number?: number;    // position in append-only audit log
  _log_segment_id?: string;     // groups log entries by day or segment
}

// ─── SERVICE HANDLERS ─────────────────────────────────────────────────────────

export interface Service_Success_Handler {
  success: true;
  _OPS_STATUS: "COMPLETED" | "PENDING";
  _OPS_MESSAGE: string;
  _OPS_META: OPS_META;
  _OPS_SECURITY: SECURITY_AUDIT;
  _OPS_INTEGRITY: INTEGRITY_PROOF;
  _OPS_DATA?: object;
}

export interface Service_Error_Handler {
  success: false;
  _OPS_STATUS: "OPERATION_FAILURE" | "SYSTEM_FAILURE";
  _OPS_MESSAGE: string;
  _OPS_META: OPS_META;
  _OPS_SECURITY: SECURITY_AUDIT;
  _OPS_INTEGRITY: INTEGRITY_PROOF;
  _OPS_DATA?: object;
  _OPS_ERROR: {
    code: string;               // machine-readable e.g. "AUTH_FACTOR_FAILED"
    category: ERROR_CATEGORY;
    retryable: boolean;
    retry_after_ms?: number;
    stack_ref?: string;         // reference to internal log — never raw stack
  };
}