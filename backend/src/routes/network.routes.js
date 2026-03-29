import express              from 'express';
import { validate }        from '../middleware/validate.js';
import { z }               from 'zod';
import * as controller     from '../controllers/network.controller.js';

const router = express.Router();

// ─── Relationship graph ───────────────────────────────────────────────────────

router.get('/api/relationships/graph',                                              controller.getRelationshipGraph);
router.get('/api/relationships/high-value',                                         controller.getHighValueRelationships);
router.get('/api/relationships/:id/network-context',                                controller.getNetworkContext);
router.post('/api/relationships/:id/next-move',                                     controller.calcNextMove);
router.post('/api/relationships/:id/intro-request-draft',                           controller.createIntroDraft);

router.post('/api/relationships/edges', validate(z.object({
  from_contact_id:  z.string().min(1),
  to_contact_id:    z.string().min(1),
  edge_type:        z.enum(['knows','worked_with','introduced','advises','invested_in','referred','met_with','board_relationship','banking_relationship','legal_relationship','operator_relationship']),
  strength:         z.union([z.enum(['weak','moderate','strong','trusted']), z.number().min(0).max(10)]).optional(),
  confidence:       z.number().min(0).max(100).optional(),
  source:           z.string().max(100).optional(),
  notes:            z.string().max(2000).optional(),
  last_verified_at: z.string().datetime().optional(),
})),                                                                                controller.createRelationshipEdge);

router.get('/api/relationships/edges',                                              controller.listRelationshipEdges);

// ─── Network intro paths ──────────────────────────────────────────────────────

router.get('/api/network/intro-paths',                                              controller.getIntroPaths);
router.post('/api/network/score-paths',                                             controller.scorePaths);
router.get('/api/network/alerts',                                                   controller.getNetworkAlerts);

// ─── Credibility + command center network ─────────────────────────────────────

router.get('/api/credibility',                                                      controller.getCredibility);
router.get('/api/command-center/network',                                           controller.getCommandCenterNetwork);
router.get('/api/investors/readiness-gaps',                                         controller.getInvestorReadinessGaps);

export default router;
