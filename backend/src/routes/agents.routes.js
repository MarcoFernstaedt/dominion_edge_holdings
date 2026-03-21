import express from 'express';
import { z }  from 'zod';
import store  from '../store.js';
import AgentOrchestrator from '../../services/AgentOrchestrator.js';
import AIService         from '../../services/AIService.js';
import DealService       from '../../services/DealService.js';
import CRMService        from '../../services/CRMService.js';
import TaskService       from '../../services/TaskService.js';
import AutomationRuleEngine from '../../services/AutomationRuleEngine.js';
import BackgroundJobRunner  from '../../services/BackgroundJobRunner.js';
import AuditLogService      from '../../services/AuditLogService.js';
import CacheService         from '../../services/CacheService.js';
import CostControlService   from '../../services/CostControlService.js';
import AgentRunLogger       from '../../services/AgentRunLogger.js';
import PromptRegistry       from '../../services/PromptRegistry.js';
import ModelGateway         from '../../services/ModelGateway.js';
import DealProbabilityService from '../../services/DealProbabilityService.js';
import { validate }          from '../middleware/validate.js';
import { errorResponse }     from '../middleware/errorResponse.js';
import { findById }          from '../lib/helpers.js';
import {
  AgentModelSchema,
  ResponseAnalysisSchema, CalendarSchedulingSchema, DailyOperationsSchema,
  BoardBuilderSchema, OutreachGenerationSchema, DealAnalysisSchema,
  LeadDiscoverySchema, TargetQualificationSchema, StrategyAdvisorSchema,
} from '../../schemas/index.js';

const router = express.Router();

async function runAgent(agentName, input, req, res) {
  try {
    const result = await AgentOrchestrator.run(agentName, { ...input, costFlags: store.settings });
    res.json(result);
  } catch (err) {
    const code   = err.code === 'FEATURE_DISABLED' ? 'FEATURE_DISABLED' : 'AI_UNAVAILABLE';
    const status = err.code === 'FEATURE_DISABLED' ? 402 : 503;
    console.error(`[agents/${agentName}]`, err.message);
    errorResponse(res, status, code, err.message);
  }
}

router.post('/api/agents/analyze-response', validate(ResponseAnalysisSchema), (req, res) =>
  runAgent('ResponseAnalysisAgent', req.validated, req, res));

router.post('/api/agents/schedule-meeting', validate(CalendarSchedulingSchema), (req, res) =>
  runAgent('CalendarSchedulingAgent', req.validated, req, res));

router.post('/api/agents/daily-briefing', validate(DailyOperationsSchema), (req, res) =>
  runAgent('DailyOperationsAgent', {
    pipeline: store.deals, tasks: store.tasks, meetings: store.meetings, date: req.validated.date,
  }, req, res));

router.post('/api/agents/board-analysis', validate(BoardBuilderSchema), (req, res) =>
  runAgent('BoardBuilderAgent', {
    candidates: store.boardCandidates, currentSeats: store.boardSeats,
    targetIndustry: req.validated.targetIndustry, dealContext: req.validated.dealContext,
  }, req, res));

router.post('/api/agents/generate-outreach', validate(OutreachGenerationSchema), (req, res) =>
  runAgent('OutreachGenerationAgent', req.validated, req, res));

router.post('/api/agents/analyze-deal', validate(DealAnalysisSchema), (req, res) => {
  const { companyId, financials, notes } = req.validated;
  const company = companyId ? findById(store.companies, companyId) : null;
  return runAgent('DealAnalysisAgent', { company, financials, notes }, req, res);
});

router.post('/api/agents/crm-health', validate(z.object({ model: AgentModelSchema })), (req, res) =>
  runAgent('CRMStewardAgent', {
    companies: store.companies, contacts: store.contacts, interactions: store.interactions,
  }, req, res));

router.post('/api/agents/lead-discovery', validate(LeadDiscoverySchema), (req, res) =>
  runAgent('LeadDiscoveryAgent', {
    ...req.validated,
    currentPipelineCount: store.deals.filter((d) => d.status === 'active').length,
  }, req, res));

router.post('/api/agents/qualify-target', validate(TargetQualificationSchema), (req, res) => {
  const { companyId, researchNotes, linkedinData, websiteSignals } = req.validated;
  const company = companyId ? findById(store.companies, companyId) : null;
  return runAgent('TargetQualificationAgent', { company, researchNotes, linkedinData, websiteSignals }, req, res);
});

router.post('/api/agents/strategy-advice', validate(StrategyAdvisorSchema), (req, res) => {
  const { question, context, dealId } = req.validated;
  const deal = dealId ? findById(store.deals, dealId) : null;
  const dealData = deal ? { ...deal, company: findById(store.companies, deal.companyId) } : null;
  return runAgent('StrategyAdvisorAgent', { question, context, dealData }, req, res);
});

router.post('/api/agents/conversation-prep', validate(z.object({
  meetingId: z.string().uuid(),
  model:     z.string().max(100).optional(),
})), async (req, res) => {
  try {
    const result = await AgentOrchestrator.run('ConversationPreparationAgent', {
      meetingId: req.validated.meetingId,
      store,
      costFlags: store.settings,
    });
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'AI_UNAVAILABLE', err.message);
  }
});

router.post('/api/agents/deal-probability-commentary', validate(z.object({
  dealId: z.string().uuid(),
  model:  z.string().max(100).optional(),
})), async (req, res) => {
  try {
    const deal = findById(store.deals, req.validated.dealId);
    if (!deal) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
    const company      = deal.companyId ? findById(store.companies, deal.companyId) : null;
    const interactions = (store.interactions || []).filter((i) => i.companyId === deal.companyId || i.dealId === deal.id);
    const scenarios    = (store.underwritingScenarios || []).filter((s) => s.dealId === deal.id);
    DealProbabilityService.refreshDealProbability(deal, store);
    const result = await AgentOrchestrator.run('DealProbabilityCommentaryAgent', {
      deal, interactions, scenarios, company, costFlags: store.settings,
    });
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'AI_UNAVAILABLE', err.message);
  }
});

router.get('/api/agents', (_req, res) => {
  res.json({
    agents: AgentOrchestrator.listAgents(),
    modelRoutes: AIService.listRoutes(),
  });
});

// ─── Service API routes ───────────────────────────────────────────────────────

router.get('/api/services/deal/stages', (_req, res) => {
  res.json({ stages: DealService.DEAL_STAGES });
});

router.post('/api/services/deal/dscr', validate(z.object({
  netOperatingIncome: z.number(),
  annualDebtService:  z.number().positive(),
})), (req, res) => {
  const { netOperatingIncome, annualDebtService } = req.validated;
  const dscr = DealService.calculateDSCR(netOperatingIncome, annualDebtService);
  res.json({ dscr, meetsThreshold: dscr >= 1.25, threshold: 1.25 });
});

router.post('/api/services/deal/loan-payment', validate(z.object({
  principal:  z.number().positive(),
  annualRate: z.number().min(0).max(1),
  termYears:  z.number().int().min(1).max(30),
})), (req, res) => {
  const { principal, annualRate, termYears } = req.validated;
  res.json({
    monthlyPayment:    DealService.monthlyLoanPayment(principal, annualRate, termYears),
    annualDebtService: DealService.annualDebtService(principal, annualRate, termYears),
    totalCost: +(DealService.monthlyLoanPayment(principal, annualRate, termYears) * termYears * 12).toFixed(2),
  });
});

router.post('/api/services/deal/valuation', validate(z.object({
  sde:          z.number().min(0).optional(),
  ebitda:       z.number().min(0).optional(),
  industryType: z.enum(['service', 'industrial', 'distribution', 'software', 'default']).optional(),
})), (req, res) => {
  const { sde, ebitda, industryType } = req.validated;
  res.json(DealService.estimateValuationRange(sde, ebitda, industryType));
});

router.get('/api/services/crm/duplicates', (_req, res) => {
  try {
    const duplicates = CRMService.findDuplicates(store.contacts);
    res.json({ duplicates, count: duplicates.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to detect duplicates');
  }
});

router.get('/api/services/tasks/overdue', (_req, res) => {
  res.json({ overdue: TaskService.detectOverdue(store.tasks) });
});

// ─── Automation routes ────────────────────────────────────────────────────────

router.get('/api/automation/rules', (_req, res) => {
  res.json({ rules: AutomationRuleEngine.listRules() });
});

router.patch('/api/automation/rules/:id', validate(z.object({ enabled: z.boolean() })), (req, res) => {
  AutomationRuleEngine.setEnabled(req.params.id, req.validated.enabled);
  const rules = AutomationRuleEngine.listRules();
  const rule  = rules.find((r) => r.id === req.params.id);
  if (!rule) return errorResponse(res, 404, 'NOT_FOUND', 'Rule not found');
  res.json(rule);
});

router.get('/api/automation/jobs', (_req, res) => {
  res.json({ jobs: BackgroundJobRunner.status() });
});

router.post('/api/automation/jobs/:id/trigger', async (req, res) => {
  try {
    await BackgroundJobRunner.trigger(req.params.id);
    res.json({ triggered: true, jobId: req.params.id });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Failed to trigger job: ${err.message}`);
  }
});

// ─── Audit log routes ─────────────────────────────────────────────────────────

router.get('/api/audit', (req, res) => {
  const { entityId, entityType, event, limit, offset } = req.query;
  const entries = AuditLogService.query({
    entityId,
    entityType,
    event,
    limit:  Math.min(Number(limit)  || 50, 200),
    offset: Number(offset) || 0,
  });
  res.json({ entries, total: AuditLogService.count() });
});

router.get('/api/cache/stats', (_req, res) => {
  res.json({ entries: CacheService.size() });
});

// ─── AI analytics routes ──────────────────────────────────────────────────────

router.get('/api/ai/cost-summary', (_req, res) => {
  try {
    res.json(CostControlService.getUsageSummary());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/ai/runs', (req, res) => {
  try {
    const { agent_name, task_type, fallback_only, errors_only, limit, offset } = req.query;
    res.json(AgentRunLogger.getRuns({
      agent_name:    agent_name || null,
      task_type:     task_type  || null,
      fallback_only: fallback_only === 'true',
      errors_only:   errors_only  === 'true',
      limit:         Math.min(Number(limit)  || 50, 200),
      offset:        Number(offset) || 0,
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/ai/metrics', (_req, res) => {
  try {
    res.json(AgentRunLogger.getSystemMetrics());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/ai/prompt-registry', (_req, res) => {
  try {
    res.json({ prompts: PromptRegistry.listPromptKeys() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/ai/task-routes', (_req, res) => {
  try {
    res.json({ routes: ModelGateway.listTaskRoutes(), providers: ModelGateway.getProviderModels() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
