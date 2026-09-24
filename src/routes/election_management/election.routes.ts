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
/**
 * @swagger
 * /election/create:
 *   post:
 *     summary: Create a new election
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateElectionRequest'
 *     responses:
 *       201:
 *         description: Election created.
 *       400:
 *         description: Invalid input.
 */
Election_routes.post(
  '/create',
  AuthMiddleware,
  NetworkContextMiddleware,
  CreateElection_Controller
);
/**
 * @swagger
 * /election/candidate:
 *   post:
 *     summary: Add a candidate to an election
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddCandidateRequest'
 *     responses:
 *       201:
 *         description: Candidate added.
 *       400:
 *         description: Invalid input.
 */
Election_routes.post(
  '/candidate',
  AuthMiddleware,
  NetworkContextMiddleware,
  AddCandidate_Controller
);

// ── Reads ────────────────────────────────────────────────────────────────────
// NOTE: /org/:orgId MUST be registered before /:electionId so "org" is never
// captured as an election id.
/**
 * @swagger
 * /election/org/{orgId}:
 *   get:
 *     summary: List elections for an organization
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Elections list.
 */
Election_routes.get('/org/:orgId', AuthMiddleware, NetworkContextMiddleware, ListElections_Controller);
/**
 * @swagger
 * /election/{electionId}/results/export:
 *   get:
 *     summary: Export election results (CSV)
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Results export.
 */
Election_routes.get('/:electionId/results/export', AuthMiddleware, NetworkContextMiddleware, ExportElectionResults_Controller);
/**
 * @swagger
 * /election/{electionId}/results:
 *   get:
 *     summary: Get election results
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Election results.
 */
Election_routes.get('/:electionId/results', AuthMiddleware, NetworkContextMiddleware, GetElectionResults_Controller);
/**
 * @swagger
 * /election/{electionId}:
 *   get:
 *     summary: Get election detail
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Election detail.
 */
Election_routes.get('/:electionId', AuthMiddleware, NetworkContextMiddleware, GetElection_Controller);

// ── Lifecycle transitions ────────────────────────────────────────────────────
/**
 * @swagger
 * /election/{electionId}/publish:
 *   post:
 *     summary: Publish an election (open voting)
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Election published.
 */
Election_routes.post('/:electionId/publish', AuthMiddleware, NetworkContextMiddleware, PublishElection_Controller);
/**
 * @swagger
 * /election/{electionId}/close:
 *   post:
 *     summary: Close an election
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Election closed.
 */
Election_routes.post('/:electionId/close', AuthMiddleware, NetworkContextMiddleware, CloseElection_Controller);
/**
 * @swagger
 * /election/{electionId}/release-results:
 *   post:
 *     summary: Release election results
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Results released.
 */
Election_routes.post('/:electionId/release-results', AuthMiddleware, NetworkContextMiddleware, ReleaseResults_Controller);

export default Election_routes;
