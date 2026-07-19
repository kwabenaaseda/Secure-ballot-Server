import { Service_Success_Handler, Service_Error_Handler } from "../../types/Response_handler";
import { OPS_Success_Params, OPS_Error_Params } from "./ops.types";
import { buildMeta } from "./helpers/build.meta";
import { buildSecurityAudit } from "./helpers/build.security";
import { buildIntegrityProof } from "./helpers/build.integrity";
import { writeAuditLog } from "./helpers/write.audit";
import { Log } from "../../utils/Logger";

// ─── OPS SUCCESS ──────────────────────────────────────────────────────────────

export async function OPS_Success(
  params: OPS_Success_Params
): Promise<Service_Success_Handler> {

  const meta      = buildMeta(params, params.started_at);
  const security  = buildSecurityAudit(params);
  const integrity = await buildIntegrityProof(meta, security, true, params.status, params.message);

  const response: Service_Success_Handler = {
    success:        true,
    _OPS_STATUS:    params.status,
    _OPS_MESSAGE:   params.message,
    _OPS_META:      meta,
    _OPS_SECURITY:  security,
    _OPS_INTEGRITY: integrity,
    _OPS_DATA:      params.data,
  };

  // Write to audit log — non-blocking so a slow DB write never delays the response.
  // The audit log is eventually consistent. The integrity chain guarantees
  // any missing entries are detectable after the fact.
  writeAuditLog(response, null).catch((err) => {
  Log.error('OPS_FACTORY', 'AUDIT_WRITE_FAILED', String(err));
});

  return response;
}

// ─── OPS ERROR ────────────────────────────────────────────────────────────────

export async function OPS_Error(
  params: OPS_Error_Params
): Promise<Service_Error_Handler> {

  const meta      = buildMeta(params, params.started_at);
  const security  = buildSecurityAudit(params);
  const integrity = await buildIntegrityProof(meta, security, false, params.status, params.message);

  const response: Service_Error_Handler = {
    success:        false,
    _OPS_STATUS:    params.status,
    _OPS_MESSAGE:   params.message,
    _OPS_META:      meta,
    _OPS_SECURITY:  security,
    _OPS_INTEGRITY: integrity,
    _OPS_DATA:      params.data,
    _OPS_ERROR: {
      code:           params.error_code,
      category:       params.error_category,
      retryable:      params.retryable,
      retry_after_ms: params.retry_after_ms,
      stack_ref:      params.stack_ref,
    },
  };

  writeAuditLog(null, response).catch((err) =>
    console.error('[OPS_FACTORY] Audit write failed:', err)
  );

  return response;
}