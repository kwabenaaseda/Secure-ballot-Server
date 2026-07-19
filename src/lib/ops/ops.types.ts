import {
  ACTOR_TYPE,
  ERROR_CATEGORY,
  INTEGRITY_CLASS,
  SECURITY_CLASSIFICATION,
  THREAT_SIGNAL,
} from "../../types/Response_handler";

// ─── NETWORK CONTEXT ─────────────────────────────────────────────────────────
// Carried in every payload so the controller stays minimal.
// The controller extracts these from req and attaches them before calling
// the service operation. Nothing raw — IP and device are hashed at source.

export interface NetworkContext {
  ip_hash: string;                  // SHA3(raw_ip + server_salt) — done in middleware
  device_fingerprint_hash?: string;  // SHA3(user_agent + screen + timezone + ...) — done client-side
  user_agent_class: "MOBILE_APP" | "DESKTOP_APP" | "BROWSER";
  correlation_id: string;           // UUID generated at request entry point
  session_id: string;               // active session ID or "NONE" for pre-auth
}

// ─── AUTH CONTEXT ─────────────────────────────────────────────────────────────
// What auth factors were used and at what confidence.
// For signup: only PASSWORD is used initially. OTP comes in verification step.

export interface AuthContext {
  factors_used: string[];           // e.g. ["PASSWORD"], ["PASSWORD","OTP","BIOMETRIC"]
  confidence: number;               // 0.0–1.0; 1.0 for non-biometric hard factors
  mfa_verified: boolean;
}

// ─── OPS INPUT ────────────────────────────────────────────────────────────────
// What every service operation passes into OPS() to build the full response.

export interface OPS_Input {
  // operation identity
  event: string;                    // e.g. "SIGNUP", "VOTE_SUBMIT"
  source: string;                   // e.g. "Signup_Operation"
  actor_type: ACTOR_TYPE;
  actor_id: string;                 // raw — OPS() will hash it internally
  started_at: number;               // Date.now() captured at operation start
  election_id?: string;
  org_id?: string;

  // classification
  classification: SECURITY_CLASSIFICATION;
  integrity_class: INTEGRITY_CLASS;

  // security signals
  network: NetworkContext;
  auth: AuthContext;
  threat_signals?: THREAT_SIGNAL[]; // pass known signals; OPS adds computed ones

  // re-vote context (only for vote operations)
  vote_sequence?: number;
  re_vote_window_remaining_ms?: number;
  prior_vote_token?: string;
}

// ─── OPS SUCCESS PARAMS ───────────────────────────────────────────────────────

export interface OPS_Success_Params extends OPS_Input {
  status: "COMPLETED" | "PENDING";
  message: string;
  data?: object;
}

// ─── OPS ERROR PARAMS ─────────────────────────────────────────────────────────

export interface OPS_Error_Params extends OPS_Input {
  status: "OPERATION_FAILURE" | "SYSTEM_FAILURE";
  message: string;
  error_code: string;
  error_category: ERROR_CATEGORY;
  retryable: boolean;
  retry_after_ms?: number;
  stack_ref?: string;
  data?: object;
}