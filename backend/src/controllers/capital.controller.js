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

// ─── Capital Raising: Investor Memos (generate) ───────────────────────────────

export async function generateMemo(req, res) {
  try {
    const { useAI = true, ...data } = req.body;
    const generated = await InvestorMemoService.generateMemo(data, useAI);
    res.json(generated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

// ─── Capital Raising: Firm Messaging ─────────────────────────────────────────

export function listMessaging(req, res) {
  const list = FirmMessagingService.list();
  res.json({ firmMessaging: list, latest: list[0] || null });
}

export const createMessagingValidate = validate(FirmMessagingSchema);

export function createMessaging(req, res) {
  try {
    const record = FirmMessagingService.create(req.validated);
    res.status(201).json(record);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

export function patchMessaging(req, res) {
  try {
    const updated = FirmMessagingService.update(req.params.id, req.body);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Firm messaging record not found');
    res.json(updated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

export async function generateMessaging(req, res) {
  try {
    const { useAI = true, ...inputs } = req.body;
    const result = await FirmMessagingService.generateMission(inputs, useAI);
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

// ─── Capital Raising: Pitch Deck ──────────────────────────────────────────────

export function listPitchDecks(req, res) {
  res.json({ pitchDecks: PitchDeckService.listDecks() });
}

export function getPitchDeck(req, res) {
  const deck = PitchDeckService.getDeck(req.params.id);
  if (!deck) return errorResponse(res, 404, 'NOT_FOUND', 'Pitch deck not found');
  res.json(deck);
}

export function createPitchDeck(req, res) {
  try {
    const deck = PitchDeckService.saveDeck(req.body);
    res.status(201).json(deck);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

export function patchPitchDeck(req, res) {
  try {
    const deck = PitchDeckService.getDeck(req.params.id);
    if (!deck) return errorResponse(res, 404, 'NOT_FOUND', 'Pitch deck not found');
    const updated = PitchDeckService.saveDeck({ ...req.body, id: req.params.id });
    res.json(updated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

export function deletePitchDeck(req, res) {
  const deleted = PitchDeckService.deleteDeck(req.params.id);
  if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Pitch deck not found');
  res.json({ success: true });
}

export async function generatePitchDeck(req, res) {
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
}

// ─── Capital Raising: Outreach ────────────────────────────────────────────────

export async function generateOutreach(req, res) {
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
}

// ─── Capital Raising: Dashboard ───────────────────────────────────────────────

export function getDashboard(req, res) {
  try {
    const pipeline = InvestorCRMService.getPipelineSummary();
    const capital  = CapitalStackService.getCapitalSummary();
    res.json({ pipeline, capital });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}
