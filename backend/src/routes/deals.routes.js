import express              from 'express';
import repo                 from '../../db/repo.js';
import store                from '../store.js';
import AutomationRuleEngine from '../../services/AutomationRuleEngine.js';
import TaskService          from '../../services/TaskService.js';
import NotificationService  from '../../services/NotificationService.js';
import AgentOrchestrator    from '../../services/AgentOrchestrator.js';
import DealProbabilityService from '../../services/DealProbabilityService.js';
import AuditLogService      from '../../services/AuditLogService.js';
import SourcingRadarService from '../../services/SourcingRadarService.js';
import MeetingPreparationService from '../../services/MeetingPreparationService.js';
import { validate, asyncRoute } from '../middleware/validate.js';
import { errorResponse }         from '../middleware/errorResponse.js';
import { uid, nowIso, findById } from '../lib/helpers.js';
import { DealSchema }            from '../../schemas/index.js';

const router = express.Router();

const serviceCtx = {
  get store() { return store; },
  taskService:         TaskService,
  notificationService: NotificationService,
  orchestrator:        AgentOrchestrator,
  uid,
  nowIso,
};

router.get('/api/deals', asyncRoute(async (req, res) => {
  const { status, stage, companyId } = req.query;
  const results = await repo.deals.list({ status, stage, companyId }, store);
  res.json(results);
}));

router.post('/api/deals', validate(DealSchema), asyncRoute(async (req, res) => {
  const deal = {
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(),
    status: 'active', stage: 'identified', stageEnteredAt: nowIso(),
    pipelinePressureLevel: 'active', daysSinceLastInteraction: 0,
    ...req.validated,
  };
  const created = await repo.deals.create(deal, store);
  res.status(201).json(created);
}));

router.get('/api/deals/:id', (req, res) => {
  try {
    const deal = findById(store.deals, req.params.id);
    if (!deal) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
    const scenarios    = store.underwritingScenarios.filter((s) => s.dealId === req.params.id);
    const interactions = store.interactions.filter((i) => i.dealId === req.params.id);
    const documents    = store.documents.filter((d) => d.entityId === req.params.id);
    res.json({ ...deal, scenarios, interactions, documents });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve deal');
  }
});

router.patch('/api/deals/:id', validate(DealSchema.partial()), asyncRoute(async (req, res) => {
  const existing = await repo.deals.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
  const updates      = { ...req.validated, updatedAt: nowIso() };
  const stageChanged = updates.stage && updates.stage !== existing.stage;
  if (stageChanged) updates.stageEnteredAt = nowIso();
  const updated = await repo.deals.update(req.params.id, updates, store);
  if (stageChanged) AutomationRuleEngine.fire('deal_stage_changed', { deal: updated, stage: updated.stage }, serviceCtx);
  res.json(updated);
}));

// ─── Deal Probability ─────────────────────────────────────────────────────────

router.get('/api/deals/:id/probability', (req, res) => {
  try {
    const deal = findById(store.deals, req.params.id);
    if (!deal) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
    const explanation = DealProbabilityService.explainProbabilityScore(deal);
    res.json({
      probabilityScore:     deal.probabilityScore ?? null,
      probabilityBand:      deal.probabilityBand  ?? null,
      probabilityUpdatedAt: deal.probabilityUpdatedAt ?? null,
      probabilityFactors:   deal.probabilityFactors ?? null,
      probabilityNotes:     deal.probabilityNotes ?? null,
      ...explanation,
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to get probability');
  }
});

router.post('/api/deals/:id/probability/refresh', (req, res) => {
  try {
    const deal = findById(store.deals, req.params.id);
    if (!deal) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
    DealProbabilityService.refreshDealProbability(deal, store);
    AuditLogService.log(AuditLogService.AUDIT_EVENTS.AGENT_RUN, 'system', deal.id, { action: 'probability_refresh', score: deal.probabilityScore });
    res.json({ probabilityScore: deal.probabilityScore, probabilityBand: deal.probabilityBand, probabilityFactors: deal.probabilityFactors });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Probability refresh failed');
  }
});

router.post('/api/deals/probability/refresh-all', (req, res) => {
  try {
    const count = DealProbabilityService.refreshAllActiveDealProbabilities(store);
    res.json({ refreshed: count });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Bulk probability refresh failed');
  }
});

// ─── Dashboard: Probability + Sourcing + Prep summaries ──────────────────────

router.get('/api/dashboard/probability-summary', (req, res) => {
  try {
    const activeDeals     = (store.deals || []).filter((d) => d.status === 'active');
    const highThreshold   = store.settings?.probabilityHighThreshold || 60;
    const lowThreshold    = store.settings?.probabilityLowRescueThreshold || 30;

    const highProbability = activeDeals
      .filter((d) => (d.probabilityScore ?? 0) >= highThreshold)
      .sort((a, b) => (b.probabilityScore || 0) - (a.probabilityScore || 0))
      .slice(0, 5)
      .map((d) => ({ id: d.id, companyName: d.companyName, probabilityScore: d.probabilityScore, probabilityBand: d.probabilityBand, stage: d.stage }));

    const lowProbability = activeDeals
      .filter((d) => d.probabilityScore !== undefined && d.probabilityScore < lowThreshold)
      .sort((a, b) => (a.probabilityScore || 0) - (b.probabilityScore || 0))
      .slice(0, 5)
      .map((d) => ({ id: d.id, companyName: d.companyName, probabilityScore: d.probabilityScore, probabilityBand: d.probabilityBand, stage: d.stage, mainBlocker: (d.probabilityNotes || 'Review deal details') }));

    res.json({ highProbability, lowProbability, highThreshold, lowThreshold });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute probability summary');
  }
});

router.get('/api/dashboard/sourcing-summary', (req, res) => {
  try {
    const now       = Date.now();
    const todayStart = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const allCandidates  = store.sourcingRadarCandidates || [];
    const newToday       = allCandidates.filter((c) => c.createdAt >= todayStart).length;
    const highPriority   = allCandidates.filter((c) => c.reviewStatus === 'pending_review' && c.relevanceScore >= (store.settings?.sourcingMinRelevanceThreshold || 50)).length;
    const sourceWarnings = (store.sourceAdapters || []).filter((a) => a.isEnabled && ['unreachable', 'misconfigured', 'rate_limited'].includes(a.status)).length;
    const lastRun        = SourcingRadarService.getLastRun();

    res.json({ newCandidatesToday: newToday, highPriorityCount: highPriority, sourceWarnings, lastRunAt: lastRun?.completedAt || null, lastRunStatus: lastRun?.status || null });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute sourcing summary');
  }
});

router.get('/api/dashboard/prep-summary', (req, res) => {
  try {
    const upcomingWindow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const upcomingMeetings = (store.meetings || []).filter((m) => {
      if (!['confirmed', 'scheduled', 'proposed'].includes(m.status)) return false;
      const start = new Date(m.startsAt);
      return start > now && start <= upcomingWindow;
    });

    const prepPacketIds        = new Set((store.meetingPrepPackets || []).map((p) => p.meetingId));
    const missingPrep          = upcomingMeetings.filter((m) => !prepPacketIds.has(m.id));
    const highValueTypes       = ['seller_discovery', 'seller_followup', 'diligence_review'];
    const highValueMissingPrep = missingPrep.filter((m) => highValueTypes.includes(m.meetingType));

    res.json({
      upcomingCount:    upcomingMeetings.length,
      missingPrepCount: missingPrep.length,
      highValueMissing: highValueMissingPrep.length,
      meetings: upcomingMeetings.slice(0, 5).map((m) => ({
        id: m.id, title: m.title, meetingType: m.meetingType, startsAt: m.startsAt,
        hasPrepPacket: prepPacketIds.has(m.id),
      })),
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute prep summary');
  }
});

export default router;
