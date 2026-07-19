import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { OPS_Input } from "../ops.types";
import { OPS_META } from "../../../types/Response_handler";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const NODE_ID  = process.env.NODE_ID   ?? "node-local";
const REGION   = process.env.REGION    ?? "af-west-1";
const VERSION  = process.env.APP_VERSION ?? "0.0.1";

// ─── HASH ACTOR ID ────────────────────────────────────────────────────────────
// Actor IDs (user UUIDs) are never stored raw in logs.
// We hash them so log entries can be correlated without exposing identity.

function hashActorId(raw_id: string): string {
  return createHash("sha256").update(raw_id).digest("hex");
}

// ─── BUILD META ───────────────────────────────────────────────────────────────

export function buildMeta(input: OPS_Input, started_at: number): OPS_META {
  const now = Date.now();
  const duration_ms = now - started_at;

  return {
    _event:          input.event,
    _event_id:       randomUUID(),
    _source:         input.source,
    _correlation_id: input.network.correlation_id,
    _session_id:     input.network.session_id,
    _timestamp:      new Date(now).toISOString(),
    _duration_ms:    duration_ms,

    _actor_type: input.actor_type,
    _actor_id:   hashActorId(input.actor_id),
    _election_id: input.election_id,
    _org_id:      input.org_id,

    _node_id: NODE_ID,
    _region:  REGION,
    _version: VERSION,
  };
}