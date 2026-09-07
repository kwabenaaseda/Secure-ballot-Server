// Tier 1.3 — Step-up token verification shared by vote and account-mutation flows.
// A step-up token is a short-lived JWT (range SELF_ACCOUNT_ACCESS) carrying the
// purpose + resource it was minted for. Callers confirm both match the action.
import jwt from 'jsonwebtoken';
import { ENV } from '../../workers/env_validator';

interface StepUpClaims {
  sub: string;
  range: string;
  data?: { step_up_purpose?: string; step_up_resource?: string };
}

export function verifyStepUpToken(
  token: string,
  expectedPurpose: string,
  expectedResourceId?: string,
): { ok: true; userId: string } | { ok: false; reason: string } {
  let decoded: StepUpClaims;
  try {
    decoded = jwt.verify(token, ENV('JWT_SECRET') as jwt.Secret) as StepUpClaims;
  } catch {
    return { ok: false, reason: 'Invalid or expired step-up token.' };
  }

  if (decoded.range !== 'SELF_ACCOUNT_ACCESS') {
    return { ok: false, reason: 'Not a step-up token.' };
  }
  if (decoded.data?.step_up_purpose !== expectedPurpose) {
    return { ok: false, reason: 'Step-up token purpose mismatch.' };
  }
  if (expectedResourceId !== undefined && decoded.data?.step_up_resource !== expectedResourceId) {
    return { ok: false, reason: 'Step-up token resource mismatch.' };
  }

  return { ok: true, userId: decoded.sub };
}
