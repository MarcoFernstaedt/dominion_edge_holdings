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
import { errorResponse }     from '../middleware/errorResponse.js';
import { findById }          from '../lib/helpers.js';

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

export function analyzeResponse(req, res) {
  return runAgent('ResponseAnalysisAgent', req.validated, req, res);
}

export function scheduleMeeting(req, res) {
  return runAgent('CalendarSchedulingAgent', req.validated, req, res);
}

export function dailyBriefing(req, res) {
  return runAgent('DailyOperationsAgent', {
    pipeline: store.deals, tasks: store.tasks, meetings: store.meetings, date: req.validated.date,
  }, req, res);
}

export function boardAnalysis(req, res) {
  return runAgent('BoardBuilderAgent', {
    candidates: store.boardCandidates, currentSeats: store.boardSeats,
    targetIndustry: req.validated.targetIndustry, dealContext: req.validated.dealContext,
  }, req, res);
}

export function generateOutreach(req, res) {
  return runAgent('OutreachGenerationAgent', req.validated, req, res);
}

export function analyzeDeal(req, res) {
  const { companyId, financials, notes } = req.validated;
  const company = companyId ? findById(store.companies, companyId) : null;
  return runAgent('DealAnalysisAgent', { company, financials, notes }, req, res);
}

export function crmHealth(req, res) {
  return runAgent('CRMStewardAgent', {
    companies: store.companies, contacts: store.contacts, interactions: store.interactions,
  }, req, res);
}

export function leadDiscovery(req, res) {
  return runAgent('LeadDiscoveryAgent', {
    ...req.validated,
    currentPipelineCount: store.deals.filter((d) => d.status === 'active').length,
  }, req, res);
}

export function qualifyTarget(req, res) {
  const { companyId, researchNotes, linkedinData, websiteSignals } = req.validated;
  const company = companyId ? findById(store.companies, companyId) : null;
  return runAgent('TargetQualificationAgent', { company, researchNotes, linkedinData, websiteSignals }, req, res);
}

export function strategyAdvice(req, res) {
  const { question, context, dealId } = req.validated;
  const deal = dealId ? findById(store.deals, dealId) : null;
  const dealData = deal ? { ...deal, company: findById(store.companies, deal.companyId) } : null;
  return runAgent('StrategyAdvisorAgent', { question, context, dealData }, req, res);
}

export async function conversationPrep(req, res) {
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
}

export async function dealProbabilityCommentary(req, res) {
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
}

export function listAgents(_req, res) {
  res.json({
    agents: AgentOrchestrator.listAgents(),
    modelRoutes: AIService.listRoutes(),
  });
}

export function getDealStages(_req, res) {
  res.json({ stages: DealService.DEAL_STAGES });
}

export function calcDSCR(req, res) {
  const { netOperatingIncome, annualDebtService } = req.validated;
  const dscr = DealService.calculateDSCR(netOperatingIncome, annualDebtService);
  res.json({ dscr, meetsThreshold: dscr >= 1.25, threshold: 1.25 });
}

export function calcLoanPayment(req, res) {
  const { principal, annualRate, termYears } = req.validated;
  res.json({
    monthlyPayment:    DealService.monthlyLoanPayment(principal, annualRate, termYears),
    annualDebtService: DealService.annualDebtService(principal, annualRate, termYears),
    totalCost: +(DealService.monthlyLoanPayment(principal, annualRate, termYears) * termYears * 12).toFixed(2),
  });
}

export function calcValuation(req, res) {
  const { sde, ebitda, industryType } = req.validated;
  res.json(DealService.estimateValuationRange(sde, ebitda, industryType));
}

export function getCRMDuplicates(_req, res) {
  try {
    const duplicates = CRMService.findDuplicates(store.contacts);
    res.json({ duplicates, count: duplicates.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to detect duplicates');
  }
}

export function getOverdueTasks(_req, res) {
  res.json({ overdue: TaskService.detectOverdue(store.tasks) });
}

export function listAutomationRules(_req, res) {
  res.json({ rules: AutomationRuleEngine.listRules() });
}

export function patchAutomationRule(req, res) {
  AutomationRuleEngine.setEnabled(req.params.id, req.validated.enabled);
  const rules = AutomationRuleEngine.listRules();
  const rule  = rules.find((r) => r.id === req.params.id);
  if (!rule) return errorResponse(res, 404, 'NOT_FOUND', 'Rule not found');
  res.json(rule);
}

export function listJobs(_req, res) {
  res.json({ jobs: BackgroundJobRunner.status() });
}

export async function triggerJob(req, res) {
  try {
    await BackgroundJobRunner.trigger(req.params.id);
    res.json({ triggered: true, jobId: req.params.id });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Failed to trigger job: ${err.message}`);
  }
}

export function getAuditLog(req, res) {
  const { entityId, entityType, event, limit, offset } = req.query;
  const entries = AuditLogService.query({
    entityId,
    entityType,
    event,
    limit:  Math.min(Number(limit)  || 50, 200),
    offset: Number(offset) || 0,
  });
  res.json({ entries, total: AuditLogService.count() });
}

export function getCacheStats(_req, res) {
  res.json({ entries: CacheService.size() });
}

export function getAICostSummary(_req, res) {
  try {
    res.json(CostControlService.getUsageSummary());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function getAIRuns(req, res) {
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
}

export function getAIMetrics(_req, res) {
  try {
    res.json(AgentRunLogger.getSystemMetrics());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function getPromptRegistry(_req, res) {
  try {
    res.json({ prompts: PromptRegistry.listPromptKeys() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function getTaskRoutes(_req, res) {
  try {
    res.json({ routes: ModelGateway.listTaskRoutes(), providers: ModelGateway.getProviderModels() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
