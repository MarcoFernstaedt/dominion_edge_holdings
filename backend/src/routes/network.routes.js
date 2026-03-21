import express              from 'express';
import store               from '../store.js';
import RelationshipGraph   from '../../services/RelationshipGraph.js';
import RelationshipScoring from '../../services/RelationshipScoring.js';
import BoardSeatEngine     from '../../services/BoardSeatEngine.js';
import BoardCandidateScoring from '../../services/BoardCandidateScoring.js';
import InvestorScoring     from '../../services/InvestorScoring.js';
import CredibilityIndex    from '../../services/CredibilityIndex.js';
import NetworkAlerts       from '../../services/NetworkAlerts.js';
import ModelGateway        from '../../services/ModelGateway.js';
import { validate }        from '../middleware/validate.js';
import { errorResponse }   from '../middleware/errorResponse.js';
import { uid, nowIso, candidateSeatType } from '../lib/helpers.js';
import { z }               from 'zod';

const router = express.Router();

// ─── Relationship graph ───────────────────────────────────────────────────────

router.get('/api/relationships/graph', (req, res) => {
  try {
    const contacts  = store.contacts ?? [];
    const edges     = store.relationshipEdges ?? [];
    const highValue = RelationshipGraph.getHighValueNodes(contacts, edges, { limit: parseInt(req.query.limit ?? '20', 10), minCentrality: parseInt(req.query.minCentrality ?? '30', 10) });
    res.json({ node_count: contacts.length, edge_count: edges.length, high_value_nodes: highValue });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to build relationship graph');
  }
});

router.get('/api/relationships/high-value', (req, res) => {
  try {
    const contacts   = store.contacts ?? [];
    const edges      = store.relationshipEdges ?? [];
    const minScore   = parseInt(req.query.minScore ?? '40', 10);
    const limit      = parseInt(req.query.limit   ?? '20', 10);
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const enriched   = contacts
      .map((c) => {
        const { centrality_score, components } = RelationshipGraph.calcCentrality(c.id, adjacency, contactMap);
        const interactions = (store.interactions ?? []).filter((i) => i.contactId === c.id);
        const scored = RelationshipScoring.enrichContactLeverage(c, interactions, centrality_score);
        return { ...scored, centrality_score, centrality_components: components };
      })
      .filter((c) => c.leverage_score >= minScore)
      .sort((a, b) => b.leverage_score - a.leverage_score)
      .slice(0, limit);
    res.json({ contacts: enriched, total: enriched.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute high-value relationships');
  }
});

router.get('/api/relationships/:id/network-context', (req, res) => {
  try {
    const contacts   = store.contacts ?? [];
    const edges      = store.relationshipEdges ?? [];
    const contact    = contacts.find((c) => c.id === req.params.id);
    if (!contact) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
    const ctx        = RelationshipGraph.getNetworkContext(req.params.id, contacts, edges);
    const interactions = (store.interactions ?? []).filter((i) => i.contactId === req.params.id);
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const { centrality_score } = RelationshipGraph.calcCentrality(req.params.id, adjacency, contactMap);
    const scored   = RelationshipScoring.enrichContactLeverage(contact, interactions, centrality_score);
    const nextMove = RelationshipScoring.calcNextMove(contact, interactions, ctx.can_introduce_to);
    res.json({ ...ctx, scoring: scored, next_move: nextMove });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute network context');
  }
});

router.post('/api/relationships/:id/next-move', (req, res) => {
  try {
    const contact = store.contacts.find((c) => c.id === req.params.id);
    if (!contact) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
    const interactions = (store.interactions ?? []).filter((i) => i.contactId === req.params.id);
    const result = RelationshipScoring.calcNextMove(contact, interactions, req.body.intro_targets ?? []);
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute next move');
  }
});

router.post('/api/relationships/:id/intro-request-draft', async (req, res) => {
  try {
    const contact = store.contacts.find((c) => c.id === req.params.id);
    if (!contact) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
    const { target_name, target_context, reason } = req.body;
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Contact';
    const prompt = `Write a warm, professional intro request from me to ${name} asking them to introduce me to ${target_name ?? 'a specific contact'}.\n\nContext about the target: ${target_context ?? 'Not provided'}\nReason for intro: ${reason ?? 'Strategic relationship for deal or board purpose'}\nRelationship with ${name}: ${contact.relationshipWarmth ?? contact.relationship_warmth ?? 'warm'}\n\nWrite 3-4 sentences. Be direct, respectful of their time, and give them an easy out. No filler. Output only the message body.`;
    const draft = await ModelGateway.callAnthropic({ prompt, maxTokens: 250, model: 'LOW' });
    res.json({ contact_id: contact.id, target_name, draft: draft?.content ?? '' });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate intro draft');
  }
});

router.post('/api/relationships/edges', validate(z.object({
  from_contact_id:  z.string().min(1),
  to_contact_id:    z.string().min(1),
  edge_type:        z.enum(['knows','worked_with','introduced','advises','invested_in','referred','met_with','board_relationship','banking_relationship','legal_relationship','operator_relationship']),
  strength:         z.union([z.enum(['weak','moderate','strong','trusted']), z.number().min(0).max(10)]).optional(),
  confidence:       z.number().min(0).max(100).optional(),
  source:           z.string().max(100).optional(),
  notes:            z.string().max(2000).optional(),
  last_verified_at: z.string().datetime().optional(),
})), (req, res) => {
  try {
    const edge = { id: uid(), ...req.validated, created_at: nowIso(), updated_at: nowIso() };
    if (!store.relationshipEdges) store.relationshipEdges = [];
    store.relationshipEdges.push(edge);
    res.status(201).json({ edge });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create relationship edge');
  }
});

router.get('/api/relationships/edges', (req, res) => {
  try {
    const edges = store.relationshipEdges ?? [];
    const { from_contact_id, to_contact_id } = req.query;
    let result = edges;
    if (from_contact_id) result = result.filter((e) => e.from_contact_id === from_contact_id);
    if (to_contact_id)   result = result.filter((e) => e.to_contact_id   === to_contact_id);
    res.json({ edges: result, total: result.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to list edges');
  }
});

// ─── Network intro paths ──────────────────────────────────────────────────────

router.get('/api/network/intro-paths', (req, res) => {
  try {
    const { source_id, target_id, max_hops } = req.query;
    if (!source_id || !target_id) return errorResponse(res, 400, 'BAD_REQUEST', 'source_id and target_id are required');
    const contacts   = store.contacts ?? [];
    const edges      = store.relationshipEdges ?? [];
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const result = RelationshipGraph.findIntroPaths(source_id, target_id, adjacency, contactMap, Math.min(parseInt(max_hops ?? '2', 10), 3));
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute intro paths');
  }
});

router.post('/api/network/score-paths', (req, res) => {
  try {
    const { pairs } = req.body;
    if (!Array.isArray(pairs)) return errorResponse(res, 400, 'BAD_REQUEST', 'pairs array required');
    const contacts   = store.contacts ?? [];
    const edges      = store.relationshipEdges ?? [];
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const results = pairs.slice(0, 50).map(({ source_id, target_id, target_name, target_type }) => {
      const pathResult = RelationshipGraph.findIntroPaths(source_id, target_id, adjacency, contactMap);
      return { source_id, target_id, target_name, target_type, ...pathResult };
    });
    res.json({ results });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to score paths');
  }
});

router.get('/api/network/alerts', (req, res) => {
  try {
    const contacts   = store.contacts ?? [];
    const edges      = store.relationshipEdges ?? [];
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const enrichedContacts = contacts.map((c) => {
      const { centrality_score } = RelationshipGraph.calcCentrality(c.id, adjacency, contactMap);
      const interactions = (store.interactions ?? []).filter((i) => i.contactId === c.id);
      return RelationshipScoring.enrichContactLeverage(c, interactions, centrality_score);
    });
    const enrichedInvestors  = (store.investors ?? []).map((inv) => InvestorScoring.scoreInvestorFull(inv, {}, [], 0));
    const boardState         = BoardSeatEngine.calcBoardReadinessScore(store.boardSeats ?? [], store.boardCandidates ?? []);
    const credIdx            = CredibilityIndex.calcCredibilityIndex({ boardState, settings: store.settings ?? {}, deals: store.deals ?? [], meetings: store.meetings ?? [], documents: store.documents ?? [], investors: store.investors ?? [], contacts });
    const result = NetworkAlerts.generateNetworkAlerts({ contacts: enrichedContacts, boardCandidates: (store.boardCandidates ?? []).map((c) => BoardCandidateScoring.scoreCandidateFull(c, candidateSeatType(c))), boardSeats: boardState.analyzed_seats, investors: enrichedInvestors, credibilityIndex: credIdx, introPathResults: [] });
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate network alerts');
  }
});

// ─── Credibility + command center network ─────────────────────────────────────

router.get('/api/credibility', (req, res) => {
  try {
    const boardState = BoardSeatEngine.calcBoardReadinessScore(store.boardSeats ?? [], store.boardCandidates ?? []);
    res.json(CredibilityIndex.calcCredibilityIndex({ boardState, settings: store.settings ?? {}, deals: store.deals ?? [], meetings: store.meetings ?? [], documents: store.documents ?? [], investors: store.investors ?? [], contacts: store.contacts ?? [], thesisText: store.settings?.dealThesis ?? '' }));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute credibility index');
  }
});

router.get('/api/command-center/network', (req, res) => {
  try {
    const contacts   = store.contacts ?? [];
    const edges      = store.relationshipEdges ?? [];
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const enrichedContacts = contacts.map((c) => {
      const { centrality_score } = RelationshipGraph.calcCentrality(c.id, adjacency, contactMap);
      const interactions = (store.interactions ?? []).filter((i) => i.contactId === c.id);
      return RelationshipScoring.enrichContactLeverage(c, interactions, centrality_score);
    });
    const firmContext    = { dealSize: store.settings?.targetDealSize ?? null, industry: store.settings?.targetIndustry ?? null, thesis: store.settings?.dealThesis ?? '' };
    const enrichedInvestors = (store.investors ?? []).map((inv) => InvestorScoring.scoreInvestorFull(inv, firmContext, [], 0));
    const boardState     = BoardSeatEngine.calcBoardReadinessScore(store.boardSeats ?? [], store.boardCandidates ?? []);
    const credIdx        = CredibilityIndex.calcCredibilityIndex({ boardState, settings: store.settings ?? {}, deals: store.deals ?? [], meetings: store.meetings ?? [], documents: store.documents ?? [], investors: store.investors ?? [], contacts, thesisText: store.settings?.dealThesis ?? '' });
    const scoredCandidates = (store.boardCandidates ?? []).map((c) => BoardCandidateScoring.scoreCandidateFull(c, candidateSeatType(c)));
    const summary = NetworkAlerts.buildCommandCenterSummary({ boardState, contacts: enrichedContacts, boardCandidates: scoredCandidates, boardSeats: boardState.analyzed_seats, investors: enrichedInvestors, credibilityIndex: credIdx, introPathResults: [] });
    if (typeof summary.credibility_index === 'number') summary.credibility_index = credIdx;
    res.json(summary);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to build command center network summary');
  }
});

router.get('/api/investors/readiness-gaps', (req, res) => {
  try {
    const s = store.settings ?? {};
    const boardState = BoardSeatEngine.calcBoardReadinessScore(store.boardSeats ?? [], store.boardCandidates ?? []);
    const credIdx    = CredibilityIndex.quickCredibilityEstimate(store);
    const firmContext = { hasThesis: !!(s.dealThesis || s.thesis), hasDeal: (store.deals ?? []).some((d) => !['lost','identified'].includes(d.stage ?? d.status ?? '')), hasMemo: (store.documents ?? []).some((d) => d.documentType === 'deal_memo') || (store.investorMemos ?? []).length > 0, hasTraction: (store.meetings ?? []).filter((m) => ['banker_intro','capital_intro'].includes(m.meetingType ?? '')).length > 0, hasAsk: !!(s.askAmount || s.targetDealSize), hasIntro: (store.relationshipEdges ?? []).length > 0, credibilityScore: credIdx.score };
    const gaps = InvestorScoring.calcInvestorReadinessGaps(firmContext);
    res.json({ ...gaps, firm_context: firmContext, credibility_score: credIdx.score, credibility_label: credIdx.label });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute readiness gaps');
  }
});

export default router;
