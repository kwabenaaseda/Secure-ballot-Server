import { NetworkContext } from '../lib/ops/ops.types';
import { Request } from 'express';

export function getNetworkContext(_req: Request): NetworkContext {
  // --- Return context
  return {
    ip_hash: '',
    device_fingerprint_hash: '',
    user_agent_class: 'BROWSER',
    correlation_id: '',
    session_id: '',
  };
}
