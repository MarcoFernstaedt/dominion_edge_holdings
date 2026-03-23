/**
 * negotiation.controller.js
 *
 * HTTP interface for negotiation prep, simulation, call recap, and draft generation.
 *
 * Endpoints:
 *   GET  /api/negotiation/scenarios          — list available scenarios
 *   GET  /api/negotiation/draft-types        — list available draft types
 *   POST /api/negotiation/simulate           — run a simulation turn
 *   GET  /api/negotiation/sessions           — list simulation sessions
 *   GET  /api/negotiation/sessions/:id       — get session
 *   POST /api/negotiation/recap              — process call recap
 *   GET  /api/negotiation/recaps             — list recaps
 *   GET  /api/negotiation/recaps/:id         — get recap
 *   POST /api/negotiation/draft              — generate a draft
 */

import store from '../store.js';
import NegotiationService, { NEGOTIATION_SCENARIOS, DRAFT_TYPES } from '../../services/NegotiationService.js';
import { errorResponse } from '../middleware/errorResponse.js';

// Ensure service is wired to store
NegotiationService.init(store);

// ─── Metadata ──────────────────────────────────────────────────────────────────

export function listScenarios(_req, res) {
  res.json({
    scenarios: Object.entries(NEGOTIATION_SCENARIOS).map(([key, def]) => ({
      key,
      label: def.label,
      description: def.description,
      counterpartyRole: def.sellerRole,
    })),
  });
}

export function listDraftTypes(_req, res) {
  res.json({
    draftTypes: Object.entries(DRAFT_TYPES).map(([key, def]) => ({
      key,
      label: def.label,
      tone: def.tone,
      audience: def.audience,
    })),
  });
}

// ─── Simulation ────────────────────────────────────────────────────────────────

export async function simulate(req, res) {
  try {
    const {
      sessionId,
      dealId,
      companyId,
      contactId,
      scenario,
      role = 'buyer',
      userMessage,
    } = req.body;

    if (!scenario) return errorResponse(res, 400, 'MISSING_FIELD', 'scenario is required');
    if (!NEGOTIATION_SCENARIOS[scenario]) {
      return errorResponse(res, 400, 'INVALID_SCENARIO', `Unknown scenario: ${scenario}. Valid: ${Object.keys(NEGOTIATION_SCENARIOS).join(', ')}`);
    }
    if (!userMessage) return errorResponse(res, 400, 'MISSING_FIELD', 'userMessage is required');

    const context = NegotiationService.buildSimulationContext({ dealId, companyId, contactId, scenario, role });

    let session = sessionId ? NegotiationService.getSession(sessionId) : null;
    if (!session) {
      session = NegotiationService.createSession({ dealId, companyId, contactId, scenario, role, context });
    }

    const coachOutput = await NegotiationService.runSimulationTurn({
      sessionId: session.id,
      context,
      userMessage,
      sessionHistory: session.history,
    });

    NegotiationService.appendToSession(session.id, userMessage, coachOutput);

    res.json({
      sessionId: session.id,
      scenario,
      turn: Math.floor(session.history.length / 2),
      ...coachOutput,
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Simulation failed: ${err.message}`);
  }
}

export function listSessions(req, res) {
  try {
    const { dealId, companyId, limit = 20 } = req.query;
    let sessions = store.negotiationSessions || [];
    if (dealId)    sessions = sessions.filter(s => s.dealId === dealId);
    if (companyId) sessions = sessions.filter(s => s.companyId === companyId);
    res.json({ sessions: sessions.slice(0, Math.min(Number(limit), 100)) });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to list sessions');
  }
}

export function getSession(req, res) {
  try {
    const session = NegotiationService.getSession(req.params.id);
    if (!session) return errorResponse(res, 404, 'NOT_FOUND', 'Session not found');
    res.json(session);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to get session');
  }
}

// ─── Recap ─────────────────────────────────────────────────────────────────────

export async function processRecap(req, res) {
  try {
    const {
      meetingId,
      transcript,
      notes,
      summary,
      dealId,
      companyId,
      autoCreateTasks = true,
    } = req.body;

    if (!transcript && !notes && !summary) {
      return errorResponse(res, 400, 'MISSING_INPUT', 'At least one of transcript, notes, or summary is required');
    }

    const recap = await NegotiationService.processRecap({
      meetingId,
      transcript,
      notes,
      summary,
      dealId,
      companyId,
      autoCreateTasks,
    });

    res.status(201).json({ recap });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Recap processing failed: ${err.message}`);
  }
}

export function listRecaps(req, res) {
  try {
    const { dealId, companyId, limit = 20 } = req.query;
    const recaps = NegotiationService.listRecaps({ dealId, companyId, limit: Number(limit) });
    res.json({ recaps, total: recaps.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to list recaps');
  }
}

export function getRecap(req, res) {
  try {
    const recap = NegotiationService.getRecap(req.params.id);
    if (!recap) return errorResponse(res, 404, 'NOT_FOUND', 'Recap not found');
    res.json(recap);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to get recap');
  }
}

// ─── Draft ─────────────────────────────────────────────────────────────────────

export async function generateDraft(req, res) {
  try {
    const {
      recapId,
      meetingId,
      dealId,
      companyId,
      draftType,
      additionalContext,
    } = req.body;

    if (!draftType) return errorResponse(res, 400, 'MISSING_FIELD', 'draftType is required');
    if (!DRAFT_TYPES[draftType]) {
      return errorResponse(res, 400, 'INVALID_DRAFT_TYPE', `Unknown draftType: ${draftType}. Valid: ${Object.keys(DRAFT_TYPES).join(', ')}`);
    }

    const draft = await NegotiationService.generateDraft({
      recapId,
      meetingId,
      dealId,
      companyId,
      draftType,
      additionalContext,
    });

    res.json({ draft });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Draft generation failed: ${err.message}`);
  }
}
