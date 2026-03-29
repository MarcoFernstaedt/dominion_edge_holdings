import express from 'express';
import * as controller from '../controllers/negotiation.controller.js';

const router = express.Router();

// Metadata
router.get('/api/negotiation/scenarios',   controller.listScenarios);
router.get('/api/negotiation/draft-types', controller.listDraftTypes);

// Simulation
router.post('/api/negotiation/simulate',           controller.simulate);
router.get('/api/negotiation/sessions',            controller.listSessions);
router.get('/api/negotiation/sessions/:id',        controller.getSession);

// Call recap
router.post('/api/negotiation/recap',              controller.processRecap);
router.get('/api/negotiation/recaps',              controller.listRecaps);
router.get('/api/negotiation/recaps/:id',          controller.getRecap);

// Draft generation
router.post('/api/negotiation/draft',              controller.generateDraft);

export default router;
