import repo                   from '../../db/repo.js';
import AutomationRuleEngine    from '../../services/AutomationRuleEngine.js';
import TaskService             from '../../services/TaskService.js';
import NotificationService     from '../../services/NotificationService.js';
import AgentOrchestrator       from '../../services/AgentOrchestrator.js';
import DealProbabilityService  from '../../services/DealProbabilityService.js';
import AuditLogService         from '../../services/AuditLogService.js';
import SourcingRadarService    from '../../services/SourcingRadarService.js';
import MeetingPreparationService from '../../services/MeetingPreparationService.js';
import { errorResponse }         from '../middleware/errorResponse.js';
import { uid, nowIso } from '../lib/helpers.js';

const serviceCtx = {
  taskService:         TaskService,
  notificationService: NotificationService,
  orchestrator:        AgentOrchestrator,
  uid,
  nowIso,
};

export async function list(req, res) {
  const { status, stage, companyId } = req.query;
  const results = await repo.deals.list({ status, stage, companyId });
  res.json(results);
}

export async function create(req, res) {
  const deal = {
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(),
    status: 'active', stage: 'identified', stageEnteredAt: nowIso(),
    pipelinePressureLevel: 'active', daysSinceLastInteraction: 0,
    ...req.validated,
  };
  const created = await repo.deals.create(deal);
  res.status(201).json(created);
}

export async function getOne(req, res) {
  try {
    const deal = await repo.deals.get(req.params.id);
    if (!deal) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
    const interactions = await repo.interactions.list({ dealId: req.params.id });
    res.json({ ...deal, interactions });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve deal');
  }
}

export async function update(req, res) {
  const existing = await repo.deals.get(req.params.id);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
  const updates      = { ...req.validated, updatedAt: nowIso() };
  const stageChanged = updates.stage && updates.stage !== existing.stage;
  if (stageChanged) updates.stageEnteredAt = nowIso();
  const updated = await repo.deals.update(req.params.id, updates);
  if (stageChanged) AutomationRuleEngine.fire('deal_stage_changed', { deal: updated, stage: updated.stage }, serviceCtx);
  res.json(updated);
}

export async function getProbability(req, res) {
  try {
    const deal = await repo.deals.get(req.params.id);
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
}

export async function refreshProbability(req, res) {
  try {
    const deal = await repo.deals.get(req.params.id);
    if (!deal) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
    DealProbabilityService.refreshDealProbability(deal);
    // Persist updated scores back to DB
    await repo.deals.update(req.params.id, {
      probabilityScore:     deal.probabilityScore,
      probabilityBand:      deal.probabilityBand,
      probabilityFactors:   deal.probabilityFactors,
      probabilityNotes:     deal.probabilityNotes,
      updatedAt:            deal.updatedAt,
    });
    AuditLogService.log(AuditLogService.AUDIT_EVENTS.AGENT_RUN, 'system', deal.id, { action: 'probability_refresh', score: deal.probabilityScore });
    res.json({ probabilityScore: deal.probabilityScore, probabilityBand: deal.probabilityBand, probabilityFactors: deal.probabilityFactors });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Probability refresh failed');
  }
}

export function refreshAllProbabilities(req, res) {
  try {
    const count = DealProbabilityService.refreshAllActiveDealProbabilities();
    res.json({ refreshed: count });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Bulk probability refresh failed');
  }
}

export async function probabilitySummary(req, res) {
  try {
    const activeDeals   = await repo.deals.list({ status: 'active' });
    const highThreshold = 60;
    const lowThreshold  = 30;

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
}

export function sourcingSummary(req, res) {
  try {
    const summary = SourcingRadarService.getCandidateSummary();
    const lastRun = SourcingRadarService.getLastRun();
    res.json({
      newCandidatesToday: summary.newCandidatesToday,
      highPriorityCount:  summary.highPriorityCount,
      sourceWarnings:     summary.sourceWarnings,
      lastRunAt:          lastRun?.completedAt || null,
      lastRunStatus:      lastRun?.status || null,
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute sourcing summary');
  }
}

export function prepSummary(req, res) {
  try {
    res.json(MeetingPreparationService.getPrepSummary());
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute prep summary');
  }
}
