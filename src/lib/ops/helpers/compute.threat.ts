import { THREAT_SIGNAL } from "../../../types/Response_handler";

// ─── SIGNAL WEIGHTS ───────────────────────────────────────────────────────────
// Each signal contributes a base score. Scores are additive and capped at 100.
// Weights are tuned toward voting-context threat severity.

const SIGNAL_WEIGHTS: Record<THREAT_SIGNAL, number> = {
  NONE:                    0,
  RATE_LIMIT_APPROACHED:  10,
  RATE_LIMIT_EXCEEDED:    35,
  UNUSUAL_TIMING:         15,
  DEVICE_MISMATCH:        25,
  NETWORK_MISMATCH:       20,
  CREDENTIAL_ANOMALY:     30,
  REPEAT_ACTION:          20,
  SEQUENCE_VIOLATION:     40,
  CONCURRENT_SESSION:     45,
};

// ─── COMPUTE THREAT SCORE ─────────────────────────────────────────────────────

export function computeThreatScore(signals: THREAT_SIGNAL[]): number {
  const raw = signals.reduce((acc, signal) => acc + SIGNAL_WEIGHTS[signal], 0);
  return Math.min(raw, 100);
}

// ─── MERGE THREAT SIGNALS ─────────────────────────────────────────────────────
// Merges caller-supplied signals with any computed signals.
// Deduplicates. Always removes NONE if real signals are present.

export function mergeThreatSignals(
  supplied: THREAT_SIGNAL[],
  computed: THREAT_SIGNAL[]
): THREAT_SIGNAL[] {
  const merged = Array.from(new Set([...supplied, ...computed]));
  if (merged.length > 1) {
    return merged.filter((s) => s !== "NONE");
  }
  return merged.length === 0 ? ["NONE"] : merged;
}