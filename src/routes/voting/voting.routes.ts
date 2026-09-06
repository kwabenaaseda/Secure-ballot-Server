import Router from 'express';
import { CastVote_Controller } from '../../controllers/voting/voting.controller';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../middleware/networkContext';

const Voting_routes = Router();

/**
 * @swagger
 * tags:
 *   - name: Voting
 *     description: Voting endpoints
 */

/**
 * @swagger
 * /vote/cast:
 *   post:
 *     summary: Cast a vote in an election
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CastVoteRequest'
 *     responses:
 *       201:
 *         description: Vote recorded successfully.
 *       400:
 *         description: Invalid input, already voted, or election not open.
 */
Voting_routes.post('/cast', AuthMiddleware, NetworkContextMiddleware, CastVote_Controller);

export default Voting_routes;
