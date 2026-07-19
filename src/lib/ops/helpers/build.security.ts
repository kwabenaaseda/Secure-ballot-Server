import { OPS_Input } from "../ops.types";
import { SECURITY_AUDIT, THREAT_SIGNAL } from "../../../types/Response_handler";
import { computeThreatScore, mergeThreatSignals } from "./compute.threat";

// ─── BUILD SECURITY AUDIT ─────────────────────────────────────────────────────

export function buildSecurityAudit(
  input: OPS_Input,
  computed_signals: THREAT_SIGNAL[] = []
): SECURITY_AUDIT {

  const threat_signals = mergeThreatSignals(
    input.threat_signals ?? ["NONE"],
    computed_signals
  );

  const threat_score = computeThreatScore(threat_signals);

  return {
    _classification:  input.classification,
    _integrity_class: input.integrity_class,

    _threat_signals: threat_signals,
    _threat_score:   threat_score,

    _auth_factors_used: input.auth.factors_used,
    _auth_confidence:   input.auth.confidence,
    _mfa_verified:      input.auth.mfa_verified,

    _ip_hash:                 input.network.ip_hash,
    _device_fingerprint_hash: input.network.device_fingerprint_hash,
    _user_agent_class:        input.network.user_agent_class,

    // re-vote fields — only populated when relevant
    _vote_sequence:               input.vote_sequence,
    _re_vote_window_remaining_ms: input.re_vote_window_remaining_ms,
    _prior_vote_token:            input.prior_vote_token,
  };
}