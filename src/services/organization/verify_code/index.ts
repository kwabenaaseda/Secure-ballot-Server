// src/services/organization/verify_code/index.ts
// POST /org/:orgId/verify-code — gate for joining a PRIVATE organization.
//
// A user submits the org's short passcode. Correct → a short-lived in-memory
// GRANT is recorded (userId:orgId) that the join endpoint consumes, so the
// code can't be bypassed by calling /join directly. Wrong → attempt counted;
// 3 failures lock the (user, org) pair out of verification for 15 minutes.
//
// The counters are deliberately in-memory: they only rate-limit verification,
// never hold authoritative state, so a restart simply resets the limit.
import { AppDataSource } from '../../../config/database';
import { Organization } from '../../../entities/Organization';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { NetworkContext } from '../../../lib/ops/ops.types';

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 15 * 60 * 1000;
const GRANT_TTL_MS = 15 * 60 * 1000;

// userId:orgId → { attempts, lockedUntil } (verification state)
const attempts = new Map<string, { attempts: number; lockedUntil: number }>();
// userId:orgId → grant expiry (verified, may call join)
const grants = new Map<string, number>();

function key(userId: string, orgId: string): string {
  return `${userId}:${orgId}`;
}

/** Has this user verified the shortcode for this private org (grant unexpired)? */
export function hasJoinGrant(userId: string, orgId: string): boolean {
  const until = grants.get(key(userId, orgId));
  if (!until) return false;
  if (Date.now() > until) {
    grants.delete(key(userId, orgId));
    return false;
  }
  return true;
}

export async function VerifyOrgCode_Operation(params: {
  orgId: string;
  userId: string;
  code: string;
  network: NetworkContext;
}) {
  const started_at = Date.now();
  const ops_base = {
    event: 'VERIFY_ORG_CODE',
    source: 'VerifyOrgCode_Operation',
    actor_type: 'VOTER' as const,
    actor_id: params.userId,
    started_at,
    network: params.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'STANDARD' as const,
    org_id: params.orgId,
  };

  const org = await AppDataSource.getRepository(Organization).findOneBy({ id: params.orgId });
  if (!org) {
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: 'Organization not found.',
      error_code: 'ORG_NOT_FOUND',
      error_category: 'VALIDATION',
      retryable: false,
    });
  }
  if (org.visibility !== 'private' || !org.join_code) {
    // Public orgs (or private orgs without a code) don't gate joining.
    return await OPS_Success({
      ...ops_base,
      status: 'COMPLETED',
      message: 'No passcode required.',
      data: { verified: true, attempts_left: MAX_ATTEMPTS },
    });
  }

  const k = key(params.userId, params.orgId);
  const state = attempts.get(k);

  if (state && state.lockedUntil > Date.now()) {
    const mins = Math.max(1, Math.ceil((state.lockedUntil - Date.now()) / 60000));
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: `Too many incorrect attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
      error_code: 'CODE_LOCKED',
      error_category: 'AUTH',
      retryable: true,
      retry_after_ms: state.lockedUntil - Date.now(),
    });
  }

  if (params.code.trim().toUpperCase() !== org.join_code.toUpperCase()) {
    const prev = state && state.lockedUntil <= Date.now() ? 0 : (state?.attempts ?? 0);
    const nextAttempts = prev + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      attempts.set(k, { attempts: nextAttempts, lockedUntil: Date.now() + LOCKOUT_MS });
      return await OPS_Error({
        ...ops_base,
        status: 'OPERATION_FAILURE',
        message: 'Incorrect passcode. 3 failed attempts — verification locked for 15 minutes.',
        error_code: 'CODE_LOCKED',
        error_category: 'AUTH',
        retryable: true,
        retry_after_ms: LOCKOUT_MS,
      });
    }
    attempts.set(k, { attempts: nextAttempts, lockedUntil: 0 });
    return await OPS_Error({
      ...ops_base,
      status: 'OPERATION_FAILURE',
      message: `Incorrect passcode. ${MAX_ATTEMPTS - nextAttempts} attempt${
        MAX_ATTEMPTS - nextAttempts === 1 ? '' : 's'
      } remaining.`,
      error_code: 'INVALID_CODE',
      error_category: 'AUTH',
      retryable: true,
    });
  }

  // Correct — clear attempts and grant a join window.
  attempts.delete(k);
  grants.set(k, Date.now() + GRANT_TTL_MS);
  return await OPS_Success({
    ...ops_base,
    status: 'COMPLETED',
    message: 'Passcode accepted. You can now request to join.',
    data: { verified: true, attempts_left: MAX_ATTEMPTS, grant_minutes: GRANT_TTL_MS / 60000 },
  });
}