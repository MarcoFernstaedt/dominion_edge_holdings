import { z }  from 'zod';
import store  from '../store.js';
import PipelinePressureService         from '../../services/PipelinePressureService.js';
import SourceAdapterRegistryService    from '../../services/SourceAdapterRegistryService.js';
import SourcingRadarService            from '../../services/SourcingRadarService.js';
import CandidateDeduplicationService   from '../../services/CandidateDeduplicationService.js';
import AuditLogService                 from '../../services/AuditLogService.js';
import { validate }                    from '../middleware/validate.js';
import { errorResponse }               from '../middleware/errorResponse.js';
import { uid, nowIso }                 from '../lib/helpers.js';

// ─── Performance Systems ──────────────────────────────────────────────────────

export function getPipelinePressure(_req, res) {
  try {
    PipelinePressureService.updatePressureLevels(store);
    res.json(PipelinePressureService.getDashboardMetrics(store));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute pipeline pressure');
  }
}

export function getScoreboard(_req, res) {
  try {
    res.json(PipelinePressureService.computeScoreboard(store));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute scoreboard');
  }
}

export function getDealVelocity(_req, res) {
  try {
    const velocity = PipelinePressureService.checkDealVelocity(store.deals);
    const slowMoving = velocity.filter((v) => v.slowMoving);
    res.json({ deals: velocity, slowMovingCount: slowMoving.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute deal velocity');
  }
}

export function getConversationFunnel(_req, res) {
  try {
    res.json(PipelinePressureService.computeConversationFunnel(store));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute conversation funnel');
  }
}

export function getFrequencyProgress(_req, res) {
  try {
    res.json(PipelinePressureService.computeFrequencyProgress(store));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute frequency progress');
  }
}

export function scanPipelinePressure(_req, res) {
  try {
    PipelinePressureService.updatePressureLevels(store);
    const stalled = PipelinePressureService.scanForStalledEntities(store);
    const created = PipelinePressureService.createFollowUpTasks(stalled, store, uid, nowIso);
    const metrics = PipelinePressureService.getDashboardMetrics(store);
    AuditLogService.log(AuditLogService.AUDIT_EVENTS.AGENT_RUN, 'system', 'pipeline_pressure_scan', { tasksCreated: created.length });
    res.json({ ...metrics, tasksCreated: created.length, tasks: created });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Pipeline scan failed');
  }
}

// ─── Sourcing Radar routes ────────────────────────────────────────────────────

export function listAdapters(_req, res) {
  try {
    res.json({ adapters: SourceAdapterRegistryService.getAllAdapters() });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to list adapters');
  }
}

export const patchAdapterValidate = validate(z.object({
  isEnabled:   z.boolean().optional(),
  adapterName: z.string().max(200).trim().optional(),
  config:      z.record(z.any()).optional(),
}).strict());

export function patchAdapter(req, res) {
  try {
    const updated = SourceAdapterRegistryService.updateAdapter(req.params.id, req.validated);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Adapter not found');
    res.json({ adapter: { ...updated, config: { ...updated.config, apiKey: updated.config?.apiKey ? '***' : undefined } } });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

export async function adapterHealthCheck(req, res) {
  try {
    const result = await SourceAdapterRegistryService.runHealthCheck(req.params.id);
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

export async function runSourcingRadar(req, res) {
  try {
    const runRecord = await SourcingRadarService.runScheduledScan({ manual: true, triggeredBy: 'manual', settings: store.settings });
    res.json({ run: runRecord });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Scan failed: ${err.message}`);
  }
}

export function listSourcingRadarRuns(req, res) {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  res.json({ runs: SourcingRadarService.getRunHistory(limit) });
}

export function listCandidates(req, res) {
  const { reviewStatus, minScore, industry, state } = req.query;
  const list = SourcingRadarService.getReviewQueue({
    reviewStatus,
    minScore: minScore ? Number(minScore) : undefined,
    industry,
    state,
  });
  res.json({ candidates: list, total: list.length });
}

export const patchCandidateValidate = validate(z.object({
  reviewStatus:        z.enum(['pending_review', 'accepted_to_crm', 'rejected', 'archived']).optional(),
  qualificationStatus: z.enum(['unreviewed', 'qualified', 'disqualified', 'needs_manual_review']).optional(),
  notes:               z.string().max(5000).optional(),
}).strict());

export function patchCandidate(req, res) {
  try {
    const candidate = SourcingRadarService.updateCandidateReview(req.params.id, req.validated);
    if (!candidate) return errorResponse(res, 404, 'NOT_FOUND', 'Candidate not found');
    res.json({ candidate });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

export function acceptCandidate(req, res) {
  try {
    const result = SourcingRadarService.acceptCandidateToCRM(req.params.id, uid, nowIso);
    if (!result) return errorResponse(res, 404, 'NOT_FOUND', 'Candidate not found');
    AuditLogService.log(AuditLogService.AUDIT_EVENTS.COMPANY_CREATED, 'sourcing_radar', result.candidate.id, { companyId: result.company.id });
    res.json({ company: result.company, candidate: result.candidate });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

export const importCsvValidate = validate(z.object({
  rows: z.array(z.record(z.string())).min(1).max(500),
}).strict());

export async function importCsv(req, res) {
  try {
    const { rows } = req.validated;
    const adapters = SourceAdapterRegistryService.getEnabledAdapters();
    const manualEntry = adapters.find((e) => e.meta.adapterType === 'manual_import');
    if (!manualEntry) return errorResponse(res, 400, 'ADAPTER_DISABLED', 'Manual import adapter not enabled');

    const { candidates } = await manualEntry.instance.fetchCandidates({ filters: { rows } });

    let inserted = 0;
    let duplicates = 0;
    for (const c of candidates) {
      const { dedupeStatus, linkedCompanyId, normalizedHash } =
        CandidateDeduplicationService.determineDedupeStatus(c, store.companies, store.sourcingRadarCandidates);
      if (dedupeStatus === 'matched_existing') { duplicates++; continue; }
      const now = nowIso();
      store.sourcingRadarCandidates.unshift({
        id: uid(),
        sourceAdapterId: manualEntry.meta.id,
        ...c,
        normalizedHash,
        dedupeStatus,
        qualificationStatus: 'unreviewed',
        relevanceScore: SourcingRadarService.scoreCandidateRelevance(c, store.settings),
        reviewStatus: 'pending_review',
        linkedCompanyId: linkedCompanyId || null,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    }
    store.sourcingRadarCandidates = store.sourcingRadarCandidates.slice(0, 1000);
    res.json({ inserted, duplicates, total: rows.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `CSV import failed: ${err.message}`);
  }
}
