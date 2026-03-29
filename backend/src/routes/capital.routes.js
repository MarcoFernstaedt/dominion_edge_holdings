import express from 'express';
import * as controller from '../controllers/capital.controller.js';

const router = express.Router();

// ─── Capital Raising: Investor Memos (generate) ───────────────────────────────

router.post('/api/capital-raising/memos/generate',       controller.generateMemo);

// ─── Capital Raising: Firm Messaging ─────────────────────────────────────────

router.get('/api/capital-raising/messaging',             controller.listMessaging);
router.post('/api/capital-raising/messaging',            controller.createMessagingValidate, controller.createMessaging);
router.patch('/api/capital-raising/messaging/:id',       controller.patchMessaging);
router.post('/api/capital-raising/messaging/generate',   controller.generateMessaging);

// ─── Capital Raising: Pitch Deck ──────────────────────────────────────────────

router.get('/api/capital-raising/pitch-decks',           controller.listPitchDecks);
router.get('/api/capital-raising/pitch-decks/:id',       controller.getPitchDeck);
router.post('/api/capital-raising/pitch-decks',          controller.createPitchDeck);
router.patch('/api/capital-raising/pitch-decks/:id',     controller.patchPitchDeck);
router.delete('/api/capital-raising/pitch-decks/:id',    controller.deletePitchDeck);
router.post('/api/capital-raising/pitch-decks/generate', controller.generatePitchDeck);

// ─── Capital Raising: Outreach ────────────────────────────────────────────────

router.post('/api/capital-raising/outreach/generate',    controller.generateOutreach);

// ─── Capital Raising: Dashboard ───────────────────────────────────────────────

router.get('/api/capital-raising/dashboard',             controller.getDashboard);

export default router;
