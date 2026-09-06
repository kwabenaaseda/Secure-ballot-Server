import Router from 'express';
import {
  CreateElection_Controller,
  AddCandidate_Controller,
  ListElections_Controller,
  GetElection_Controller,
  PublishElection_Controller,
  CloseElection_Controller,
  GetElectionResults_Controller,
  ReleaseResults_Controller,
  ExportElectionResults_Controller,
} from '../../controllers/election_management/election.controller';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../middleware/networkContext';

/**
 * @swagger
 * tags:
 *   - name: Elections
 *     description: Election management endpoints
 */
const Election_routes = Router();

// ── Management (write + candidate wiring) ────────────────────────────────────
Election_routes.post(
  '/create',
  AuthMiddleware,
  NetworkContextMiddleware,
  CreateElection_Controller
);
Election_routes.post(
  '/candidate',
  AuthMiddleware,
  NetworkContextMiddleware,
  AddCandidate_Controller
);

// ── Reads ────────────────────────────────────────────────────────────────────
// NOTE: /org/:orgId MUST be registered before /:electionId so "org" is never
// captured as an election id.
Election_routes.get('/org/:orgId', AuthMiddleware, NetworkContextMiddleware, ListElections_Controller);
Election_routes.get('/:electionId/results/export', AuthMiddleware, NetworkContextMiddleware, ExportElectionResults_Controller);
Election_routes.get('/:electionId/results', AuthMiddleware, NetworkContextMiddleware, GetElectionResults_Controller);
Election_routes.get('/:electionId', AuthMiddleware, NetworkContextMiddleware, GetElection_Controller);

// ── Lifecycle transitions ────────────────────────────────────────────────────
Election_routes.post('/:electionId/publish', AuthMiddleware, NetworkContextMiddleware, PublishElection_Controller);
Election_routes.post('/:electionId/close', AuthMiddleware, NetworkContextMiddleware, CloseElection_Controller);
Election_routes.post('/:electionId/release-results', AuthMiddleware, NetworkContextMiddleware, ReleaseResults_Controller);

export default Election_routes;
