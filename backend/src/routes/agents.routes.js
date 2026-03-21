import express from 'express';
import { z }  from 'zod';
import { validate } from '../middleware/validate.js';
import {
  AgentModelSchema,
  ResponseAnalysisSchema, CalendarSchedulingSchema, DailyOperationsSchema,
  BoardBuilderSchema, OutreachGenerationSchema, DealAnalysisSchema,
  LeadDiscoverySchema, TargetQualificationSchema, StrategyAdvisorSchema,
} from '../../schemas/index.js';
import * as controller from '../controllers/agents.controller.js';

const router = express.Router();

router.post('/api/agents/analyze-response',          validate(ResponseAnalysisSchema),   controller.analyzeResponse);
router.post('/api/agents/schedule-meeting',          validate(CalendarSchedulingSchema),  controller.scheduleMeeting);
router.post('/api/agents/daily-briefing',            validate(DailyOperationsSchema),     controller.dailyBriefing);
router.post('/api/agents/board-analysis',            validate(BoardBuilderSchema),        controller.boardAnalysis);
router.post('/api/agents/generate-outreach',         validate(OutreachGenerationSchema),  controller.generateOutreach);
router.post('/api/agents/analyze-deal',              validate(DealAnalysisSchema),        controller.analyzeDeal);
router.post('/api/agents/crm-health',                validate(z.object({ model: AgentModelSchema })), controller.crmHealth);
router.post('/api/agents/lead-discovery',            validate(LeadDiscoverySchema),       controller.leadDiscovery);
router.post('/api/agents/qualify-target',            validate(TargetQualificationSchema), controller.qualifyTarget);
router.post('/api/agents/strategy-advice',           validate(StrategyAdvisorSchema),     controller.strategyAdvice);
router.post('/api/agents/conversation-prep',         validate(z.object({ meetingId: z.string().uuid(), model: z.string().max(100).optional() })), controller.conversationPrep);
router.post('/api/agents/deal-probability-commentary', validate(z.object({ dealId: z.string().uuid(), model: z.string().max(100).optional() })), controller.dealProbabilityCommentary);
router.get('/api/agents',                            controller.listAgents);

router.get('/api/services/deal/stages',    controller.getDealStages);
router.post('/api/services/deal/dscr',     validate(z.object({ netOperatingIncome: z.number(), annualDebtService: z.number().positive() })), controller.calcDSCR);
router.post('/api/services/deal/loan-payment', validate(z.object({ principal: z.number().positive(), annualRate: z.number().min(0).max(1), termYears: z.number().int().min(1).max(30) })), controller.calcLoanPayment);
router.post('/api/services/deal/valuation', validate(z.object({ sde: z.number().min(0).optional(), ebitda: z.number().min(0).optional(), industryType: z.enum(['service', 'industrial', 'distribution', 'software', 'default']).optional() })), controller.calcValuation);
router.get('/api/services/crm/duplicates', controller.getCRMDuplicates);
router.get('/api/services/tasks/overdue',  controller.getOverdueTasks);

router.get('/api/automation/rules',              controller.listAutomationRules);
router.patch('/api/automation/rules/:id',        validate(z.object({ enabled: z.boolean() })), controller.patchAutomationRule);
router.get('/api/automation/jobs',               controller.listJobs);
router.post('/api/automation/jobs/:id/trigger',  controller.triggerJob);

router.get('/api/audit', controller.getAuditLog);

router.get('/api/cache/stats', controller.getCacheStats);

router.get('/api/ai/cost-summary',    controller.getAICostSummary);
router.get('/api/ai/runs',            controller.getAIRuns);
router.get('/api/ai/metrics',         controller.getAIMetrics);
router.get('/api/ai/prompt-registry', controller.getPromptRegistry);
router.get('/api/ai/task-routes',     controller.getTaskRoutes);

export default router;
