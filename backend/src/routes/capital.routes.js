import express from 'express';
import store   from '../store.js';
import InvestorCRMService   from '../../services/InvestorCRMService.js';
import CapitalStackService  from '../../services/CapitalStackService.js';
import InvestorMemoService  from '../../services/InvestorMemoService.js';
import FirmMessagingService from '../../services/FirmMessagingService.js';
import PitchDeckService     from '../../services/PitchDeckService.js';
import InvestorOutreachAgent from '../../agents/investorOutreach.js';
import AIService            from '../../services/AIService.js';
import { validate }         from '../middleware/validate.js';
import { errorResponse }    from '../middleware/errorResponse.js';
import { FirmMessagingSchema } from '../../schemas/index.js';

const router = express.Router();

// ─── Capital Raising: Investor Memos (generate) ───────────────────────────────

router.post('/api/capital-raising/memos/generate', async (req, res) => {
  try {
    const { useAI = true, ...data } = req.body;
    const generated = await InvestorMemoService.generateMemo(data, useAI);
    res.json(generated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Capital Raising: Firm Messaging ─────────────────────────────────────────

router.get('/api/capital-raising/messaging', (req, res) => {
  const list = FirmMessagingService.list();
  res.json({ firmMessaging: list, latest: list[0] || null });
});

router.post('/api/capital-raising/messaging', validate(FirmMessagingSchema), (req, res) => {
  try {
    const record = FirmMessagingService.create(req.validated);
    res.status(201).json(record);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.patch('/api/capital-raising/messaging/:id', (req, res) => {
  try {
    const updated = FirmMessagingService.update(req.params.id, req.body);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Firm messaging record not found');
    res.json(updated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.post('/api/capital-raising/messaging/generate', async (req, res) => {
  try {
    const { useAI = true, ...inputs } = req.body;
    const result = await FirmMessagingService.generateMission(inputs, useAI);
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Capital Raising: Pitch Deck ──────────────────────────────────────────────

router.get('/api/capital-raising/pitch-decks', (req, res) => {
  res.json({ pitchDecks: PitchDeckService.listDecks() });
});

router.get('/api/capital-raising/pitch-decks/:id', (req, res) => {
  const deck = PitchDeckService.getDeck(req.params.id);
  if (!deck) return errorResponse(res, 404, 'NOT_FOUND', 'Pitch deck not found');
  res.json(deck);
});

router.post('/api/capital-raising/pitch-decks', (req, res) => {
  try {
    const deck = PitchDeckService.saveDeck(req.body);
    res.status(201).json(deck);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.patch('/api/capital-raising/pitch-decks/:id', (req, res) => {
  try {
    const deck = PitchDeckService.getDeck(req.params.id);
    if (!deck) return errorResponse(res, 404, 'NOT_FOUND', 'Pitch deck not found');
    const updated = PitchDeckService.saveDeck({ ...req.body, id: req.params.id });
    res.json(updated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.delete('/api/capital-raising/pitch-decks/:id', (req, res) => {
  const deleted = PitchDeckService.deleteDeck(req.params.id);
  if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Pitch deck not found');
  res.json({ success: true });
});

router.post('/api/capital-raising/pitch-decks/generate', async (req, res) => {
  try {
    const { firmMessagingId, operatorName, useAI = true, deckTitle } = req.body;
    const firmMessaging = firmMessagingId
      ? FirmMessagingService.get(firmMessagingId)
      : FirmMessagingService.getLatest();
    const slides = await PitchDeckService.generateWithAI(firmMessaging, operatorName, useAI);
    const deck = PitchDeckService.saveDeck({
      firmMessagingId: firmMessaging?.id || null,
      deckTitle:       deckTitle || 'Investor Pitch Deck',
      slides,
    });
    res.json(deck);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Capital Raising: Outreach ────────────────────────────────────────────────

router.post('/api/capital-raising/outreach/generate', async (req, res) => {
  try {
    const { mode = 'introduction', investorId, dealSummary, useAI = true } = req.body;
    const investor      = investorId ? InvestorCRMService.getInvestor(investorId) : req.body.investor;
    const firmMessaging = FirmMessagingService.getLatest();
    const result = await InvestorOutreachAgent.run(
      { mode, investor, dealSummary, firmMessaging },
      useAI ? AIService : null
    );
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Capital Raising: Dashboard ───────────────────────────────────────────────

router.get('/api/capital-raising/dashboard', (req, res) => {
  try {
    const pipeline = InvestorCRMService.getPipelineSummary();
    const capital  = CapitalStackService.getCapitalSummary();
    res.json({ pipeline, capital });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

export default router;
