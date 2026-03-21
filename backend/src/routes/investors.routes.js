import express           from 'express';
import store             from '../store.js';
import InvestorScoring   from '../../services/InvestorScoring.js';
import InvestorCRMService from '../../services/InvestorCRMService.js';
import CapitalStackService from '../../services/CapitalStackService.js';
import InvestorMemoService from '../../services/InvestorMemoService.js';
import FirmMessagingService from '../../services/FirmMessagingService.js';
import PitchDeckService  from '../../services/PitchDeckService.js';
import RelationshipGraph from '../../services/RelationshipGraph.js';
import ModelGateway      from '../../services/ModelGateway.js';
import AutomationRuleEngine from '../../services/AutomationRuleEngine.js';
import AuditLogService   from '../../services/AuditLogService.js';
import { validate }      from '../middleware/validate.js';
import { errorResponse } from '../middleware/errorResponse.js';
import { uid, nowIso }   from '../lib/helpers.js';
import { InvestorSchema, CapitalStackSchema, InvestorMemoSchema, FirmMessagingSchema } from '../../schemas/index.js';
import TaskService       from '../../services/TaskService.js';
import NotificationService from '../../services/NotificationService.js';
import AgentOrchestrator from '../../services/AgentOrchestrator.js';

const router = express.Router();

const serviceCtx = {
  get store() { return store; },
  taskService:         TaskService,
  notificationService: NotificationService,
  orchestrator:        AgentOrchestrator,
  uid,
  nowIso,
};

// ─── Investor scoring ─────────────────────────────────────────────────────────

router.get('/api/investors/funnel', (req, res) => {
  try { res.json(InvestorScoring.buildInvestorFunnel(store.investors ?? [])); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to build investor funnel'); }
});

router.get('/api/investors/high-fit', (req, res) => {
  try {
    const firmContext = { dealSize: store.settings?.targetDealSize ?? null, industry: store.settings?.targetIndustry ?? null, stage: store.settings?.dealStage ?? null, geo: store.settings?.targetGeo ?? null, thesis: store.settings?.dealThesis ?? '' };
    const scored = (store.investors ?? []).map((inv) => InvestorScoring.scoreInvestorFull(inv, firmContext, [], 0));
    const ranked = InvestorScoring.getHighFitInvestors(scored, firmContext, { limit: parseInt(req.query.limit ?? '10', 10), minFit: parseInt(req.query.minFit ?? '60', 10) });
    res.json({ investors: ranked, total: ranked.length });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to rank investors'); }
});

router.get('/api/investors/:id/fit', (req, res) => {
  try {
    const investor = (store.investors ?? []).find((i) => i.id === req.params.id);
    if (!investor) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    const firmContext = { dealSize: store.settings?.targetDealSize ?? null, industry: store.settings?.targetIndustry ?? null, stage: store.settings?.dealStage ?? null, geo: store.settings?.targetGeo ?? null, thesis: store.settings?.dealThesis ?? '' };
    const interactions = (store.interactions ?? []).filter((i) => i.entityId === investor.id || i.investorId === investor.id);
    res.json(InvestorScoring.scoreInvestorFull(investor, firmContext, interactions, 0));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute investor fit'); }
});

router.get('/api/investors/:id/intro-paths', (req, res) => {
  try {
    const investor = (store.investors ?? []).find((i) => i.id === req.params.id);
    if (!investor) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    if (!req.query.source_id) return errorResponse(res, 400, 'BAD_REQUEST', 'source_id query param required');
    const contacts   = store.contacts ?? [];
    const edges      = store.relationshipEdges ?? [];
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const investorContactId = contacts.find((c) => c.name === investor.name || c.email === investor.email)?.id ?? investor.id;
    const result = RelationshipGraph.findIntroPaths(req.query.source_id, investorContactId, adjacency, contactMap);
    res.json({ investor_id: investor.id, ...result });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute investor intro paths'); }
});

router.post('/api/investors/:id/outreach-draft', async (req, res) => {
  try {
    const investor = (store.investors ?? []).find((i) => i.id === req.params.id);
    if (!investor) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    const { context, tone } = req.body;
    const firmContext = { dealSize: store.settings?.targetDealSize, industry: store.settings?.targetIndustry, thesis: store.settings?.dealThesis ?? '' };
    const scored  = InvestorScoring.scoreInvestorFull(investor, firmContext, [], 0);
    const prompt  = `Write a personalized first-touch outreach email to ${investor.name} (${investor.organization ?? ''}) for a search fund acquisition.\n\nInvestor type: ${investor.investorType}\nFit score: ${scored.fit_score} (${scored.fit_label})\nWarmth: ${scored.warmth_state}\nTone: ${tone ?? 'professional and direct'}\nContext: ${context ?? 'Looking to raise equity for a small business acquisition'}\nIndustries preferred: ${(investor.industriesPreferred ?? []).join(', ') || 'general'}\n\nWrite subject line + email body. 4-6 sentences. No filler. End with a clear ask.`;
    const draft = await ModelGateway.callAnthropic({ prompt, maxTokens: 400, model: 'MID' });
    res.json({ investor_id: investor.id, fit_score: scored.fit_score, warmth_state: scored.warmth_state, draft: draft?.content ?? '' });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate outreach draft'); }
});

router.post('/api/investors/:id/memo-section-draft', async (req, res) => {
  try {
    const investor = (store.investors ?? []).find((i) => i.id === req.params.id);
    if (!investor) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    const { section, dealContext } = req.body;
    const scored = InvestorScoring.scoreInvestorFull(investor, {}, [], 0);
    const prompt = `Write the "${section ?? 'investor summary'}" section of an investor memo targeting ${investor.name}.\n\nInvestor profile: ${investor.investorType}, check size $${investor.checkSizeMin ?? '?'}–$${investor.checkSizeMax ?? '?'}, industries: ${(investor.industriesPreferred ?? []).join(', ') || 'general'}\nFit score: ${scored.fit_score}\nDeal context: ${dealContext ?? store.settings?.dealThesis ?? 'SMB acquisition in target industry'}\n\nWrite 2-3 tight paragraphs. Tailored to this investor's profile. No filler.`;
    const draft = await ModelGateway.callAnthropic({ prompt, maxTokens: 500, model: 'MID' });
    res.json({ investor_id: investor.id, section: section ?? 'investor_summary', draft: draft?.content ?? '' });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate memo section'); }
});

// ─── Capital raising CRM ──────────────────────────────────────────────────────

router.get('/api/capital-raising/investors', (req, res) => {
  try {
    const { investorType, relationshipStage, minCheckSize, industry } = req.query;
    const list = InvestorCRMService.listInvestors({ investorType, relationshipStage, minCheckSize: minCheckSize ? Number(minCheckSize) : undefined, industry });
    res.json({ investors: list, total: list.length });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.post('/api/capital-raising/investors', validate(InvestorSchema), (req, res) => {
  try {
    const investor = InvestorCRMService.createInvestor(req.validated);
    AutomationRuleEngine.fire('investor_created', { investor }, serviceCtx);
    res.status(201).json(investor);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/capital-raising/investors/:id', (req, res) => {
  const investor = InvestorCRMService.getInvestor(req.params.id);
  if (!investor) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
  res.json(investor);
});

router.patch('/api/capital-raising/investors/:id', (req, res) => {
  try {
    const updated = InvestorCRMService.updateInvestor(req.params.id, req.body);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    if (updated.relationshipStage === 'engaged') AutomationRuleEngine.fire('investor_engaged', { investor: updated }, serviceCtx);
    res.json(updated);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.delete('/api/capital-raising/investors/:id', (req, res) => {
  const deleted = InvestorCRMService.deleteInvestor(req.params.id);
  if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
  res.json({ success: true });
});

router.post('/api/capital-raising/investors/:id/mark-interested', (req, res) => {
  try {
    const updated = InvestorCRMService.markInterested(req.params.id);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    res.json(updated);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

// ─── Capital stacks ───────────────────────────────────────────────────────────

router.get('/api/capital-raising/capital-stacks', (req, res) => {
  res.json({ capitalStacks: CapitalStackService.listStacks(req.query.dealId || null) });
});

router.post('/api/capital-raising/capital-stacks', validate(CapitalStackSchema), (req, res) => {
  try {
    const stack = CapitalStackService.createStack(req.validated.dealId, req.validated);
    res.status(201).json(stack);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/capital-raising/capital-stacks/:id', (req, res) => {
  const stack = CapitalStackService.getStack(req.params.id);
  if (!stack) return errorResponse(res, 404, 'NOT_FOUND', 'Capital stack not found');
  res.json(stack);
});

router.patch('/api/capital-raising/capital-stacks/:id', (req, res) => {
  try {
    const updated = CapitalStackService.updateStack(req.params.id, req.body);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Capital stack not found');
    res.json(updated);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.delete('/api/capital-raising/capital-stacks/:id', (req, res) => {
  const deleted = CapitalStackService.deleteStack(req.params.id);
  if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Capital stack not found');
  res.json({ success: true });
});

// ─── Investor memos ───────────────────────────────────────────────────────────

router.get('/api/capital-raising/memos', (req, res) => {
  res.json({ memos: InvestorMemoService.listMemos(req.query.dealId || null) });
});

router.post('/api/capital-raising/memos', validate(InvestorMemoSchema), (req, res) => {
  try {
    res.status(201).json(InvestorMemoService.createMemo(req.validated));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/capital-raising/memos/:id', (req, res) => {
  const memo = InvestorMemoService.getMemo(req.params.id);
  if (!memo) return errorResponse(res, 404, 'NOT_FOUND', 'Memo not found');
  res.json(memo);
});

router.patch('/api/capital-raising/memos/:id', (req, res) => {
  try {
    const updated = InvestorMemoService.updateMemo(req.params.id, req.body);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Memo not found');
    res.json(updated);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.delete('/api/capital-raising/memos/:id', (req, res) => {
  const deleted = InvestorMemoService.deleteMemo(req.params.id);
  if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Memo not found');
  res.json({ success: true });
});

export default router;
