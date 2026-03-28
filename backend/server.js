import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { z } from 'zod';
import pino from 'pino';

// ─── Schemas ──────────────────────────────────────────────────────────────────
import {
  CompanySchema, ContactSchema, InteractionSchema, DealSchema, TaskSchema,
  BoardCandidateSchema, DocumentSchema, ComposeSchema, SettingsPatchSchema,
  UnderwritingCalcSchema, ChatSchema, OutreachGenerateSchema, ReplySuggestionSchema,
  MeetingSchema, AgentModelSchema, ResponseAnalysisSchema, CalendarSchedulingSchema,
  DailyOperationsSchema, BoardBuilderSchema, OutreachGenerationSchema, DealAnalysisSchema,
  LeadDiscoverySchema, TargetQualificationSchema, StrategyAdvisorSchema,
  IntegrationPatchSchema, InvestorSchema, CapitalStackSchema, InvestorMemoSchema,
  FirmMessagingSchema, DealFeedListingSchema, DealFeedListingPatchSchema,
  SaveListingSchema, ImportListingSchema, CsvIngestSchema,
  RelationshipSchema, RelationshipPatchSchema, RelationshipInteractionSchema,
  ScheduleFollowUpSchema, ConversationSchema, ConversationPatchSchema,
  ConversationTargetSchema,
} from './schemas/index.js';

// ─── Services ─────────────────────────────────────────────────────────────────
import AgentOrchestrator       from './services/AgentOrchestrator.js';
import AutomationRuleEngine    from './services/AutomationRuleEngine.js';
import BackgroundJobRunner     from './services/BackgroundJobRunner.js';
import CacheService            from './services/CacheService.js';
import AuditLogService         from './services/AuditLogService.js';
import AIService               from './services/AIService.js';
import DealService             from './services/DealService.js';
import CRMService              from './services/CRMService.js';
import TaskService             from './services/TaskService.js';
import NotificationService     from './services/NotificationService.js';
import IntegrationRegistry     from './services/IntegrationRegistry.js';
import IntegrationHealthService from './services/IntegrationHealthService.js';
import PipelinePressureService  from './services/PipelinePressureService.js';
import VelocityService          from './services/VelocityService.js';
import SourceAdapterRegistryService from './services/SourceAdapterRegistryService.js';
import SourcingRadarService    from './services/SourcingRadarService.js';
import CandidateDeduplicationService from './services/CandidateDeduplicationService.js';
import MeetingPreparationService from './services/MeetingPreparationService.js';
import DealProbabilityService  from './services/DealProbabilityService.js';
import NegotiationService, { NEGOTIATION_SCENARIOS, DRAFT_TYPES } from './services/NegotiationService.js';

// ─── Capital Raising Services ──────────────────────────────────────────────────
import InvestorCRMService    from './services/InvestorCRMService.js';
import CapitalStackService   from './services/CapitalStackService.js';
import InvestorMemoService   from './services/InvestorMemoService.js';
import FirmMessagingService  from './services/FirmMessagingService.js';
import PitchDeckService      from './services/PitchDeckService.js';
import InvestorOutreachAgent from './agents/investorOutreach.js';

// ─── Execution Tracker ────────────────────────────────────────────────────────
import ExecutionTrackerService from './services/ExecutionTrackerService.js';

// ─── Playbook Engine ──────────────────────────────────────────────────────────
import PlaybookService from './services/PlaybookService.js';

// ─── Deal Feed ────────────────────────────────────────────────────────────────
import DealFeedService        from './services/DealFeedService.js';
import DealFeedScoringService from './services/DealFeedScoringService.js';
import DealFeedIngestionJob   from './jobs/DealFeedIngestionJob.js';

// ─── Relationship Management Engine ──────────────────────────────────────────
import RelationshipService    from './services/RelationshipService.js';
import RelationshipFollowUpJob from './jobs/RelationshipFollowUpJob.js';

// ─── Conversation KPI System ──────────────────────────────────────────────────
import ConversationMetricsService from './services/ConversationMetricsService.js';
import CostControlService  from './services/CostControlService.js';
import AgentRunLogger       from './services/AgentRunLogger.js';
import PromptRegistry       from './services/PromptRegistry.js';
import ModelGateway         from './services/ModelGateway.js';
import ApprovalService      from './services/ApprovalService.js';
import * as ArtifactStore   from './services/ArtifactStore.js';
import WorkflowEngine       from './services/WorkflowEngine.js';
import NextActionEngine     from './services/NextActionEngine.js';
import ProofEngine          from './services/ProofEngine.js';
import ScoringEngine        from './services/ScoringEngine.js';
import UnderwritingEngine   from './services/UnderwritingEngine.js';
import DiligenceEngine      from './services/DiligenceEngine.js';
import SequenceEngine       from './services/SequenceEngine.js';
import TimingEngine         from './services/TimingEngine.js';
import RecoveryEngine       from './services/RecoveryEngine.js';
import ALL_THRESHOLDS       from './services/CadenceThresholds.js';

// ─── Credibility & Network Intelligence ───────────────────────────────────────
import BoardSeatEngine        from './services/BoardSeatEngine.js';
import BoardCandidateScoring  from './services/BoardCandidateScoring.js';
import RelationshipGraph      from './services/RelationshipGraph.js';
import RelationshipScoring    from './services/RelationshipScoring.js';
import InvestorScoring        from './services/InvestorScoring.js';
import CredibilityIndex       from './services/CredibilityIndex.js';
import NetworkAlerts          from './services/NetworkAlerts.js';
import ExportService          from './services/ExportService.js';

// ─── Database repository (Prisma-backed, falls back to in-memory) ─────────────
import repo from './db/repo.js';

dotenv.config();

// ─── Structured logging ───────────────────────────────────────────────────────
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } },
  }),
  base: { service: 'deh-backend', env: process.env.NODE_ENV || 'development' },
});

// ─── Environment validation ───────────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY && process.env.NODE_ENV !== 'test') {
  logger.fatal('ANTHROPIC_API_KEY is not set — refusing to start');
  process.exit(1);
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();

// Security headers via helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — strict: only allow listed origins, never default to true
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  })
);

// Compression
app.use(compression());

// Body parsing — keep limits tight
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '128kb' }));

// Request ID for tracing + structured request logging
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  req.log = logger.child({ reqId: req.id });
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    req.log[level]({ method: req.method, url: req.url, status: res.statusCode, ms });
  });
  next();
});

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Window/cap values live in RATE_LIMITS constant (defined later with other domain constants).
// They are referenced here via object literals so the limiter is created after the constants.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit reached. Please wait before making more AI requests.', code: 'AI_RATE_LIMITED' },
});

app.use('/api', generalLimiter);
app.use('/api/chat', aiLimiter);
app.use('/api/outreach/generate', aiLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/dashboard/briefing', aiLimiter);
app.use('/api/agents', aiLimiter);
app.use('/api/capital-raising/memos/generate', aiLimiter);
app.use('/api/capital-raising/messaging/generate', aiLimiter);
app.use('/api/capital-raising/pitch-deck/generate', aiLimiter);
app.use('/api/capital-raising/outreach/generate', aiLimiter);

// ─── Structured error response ────────────────────────────────────────────────
/**
 * Returns a sanitized error response — never leaks internal details in production.
 */
function errorResponse(res, status, code, message, details = undefined) {
  const body = { error: { code, message, requestId: res.req?.id } };
  if (NODE_ENV !== 'production' && details) {
    body.error.details = details;
  }
  return res.status(status).json(body);
}

// ─── Zod validation middleware ────────────────────────────────────────────────
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid request body', result.error.flatten());
    }
    req.validated = result.data;
    next();
  };
}

/**
 * Wraps an async route handler so unhandled promise rejections are forwarded
 * to the Express error handler instead of crashing the process.
 * Eliminates the need for try/catch in every async route.
 *
 * @param {Function} fn  Async (req, res, next) handler
 */
function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ─── In-memory data store (upgrade to MongoDB Atlas later) ───────────────────
const store = {
  companies: [],
  contacts: [],
  interactions: [],
  deals: [],
  underwritingScenarios: [],
  boardSeats: [],
  boardCandidates: [],
  capTable: [],
  checklistPhases: [],
  tasks: [],
  documents: [],
  emailThreads: [],
  outreachTemplates: [],
  meetings: [],
  notifications: [],
  // System: Sourcing Radar
  sourceAdapters: [],
  sourcingRadarRuns: [],
  sourcingRadarCandidates: [],
  // System: Meeting Prep
  meetingPrepPackets: [],
  // Negotiation Coach (QLA Step 10)
  negotiationSessions: [],
  callRecaps:          [],
  // Capital Raising
  investors:      [],
  capitalStacks:  [],
  investorMemos:  [],
  firmMessaging:  [],
  pitchDecks:     [],
  // Execution Tracker
  executionDailyStats:   [],
  executionWeeklyStats:  [],
  executionMonthlyStats: [],
  qlaTargets:            [],
  dealMomentumStats:     [],
  // Playbook Engine
  playbookStages:   [],
  playbookTasks:    [],
  playbookProgress: [],
  // Deal Feed Marketplace
  dealFeedListings: [],
  savedListings:    [],
  // Relationship Management Engine
  relationships:             [],
  relationshipInteractions:  [],
  relationshipEdges:         [],   // graph edges: { id, from_contact_id, to_contact_id, edge_type, strength, recency, confidence, source, notes, last_verified_at }
  // Conversation KPI System
  relationshipConversations: [],
  conversationTargets:       [],
  _metrics: {},
  settings: {
    fromName: '',
    fromEmail: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    emailMode: 'smtp_only',
    primaryModel: 'claude-haiku-4-5-20251001',
    reducedMotion: false,
    highContrast: false,
    keyboardShortcutsEnabled: true,
    density: 'standard',
    aiDraftingEnabled: true,
    aiReplyEnabled: true,
    aiBriefingEnabled: true,
    enableAIOutreachDrafts: true,
    enableAIReplySuggestions: true,
    enableDealAnalysis: true,
    enableStrategyInsights: true,
    // Contact frequency targets (System 6)
    ownersContactedPerWeek: 25,
    followUpsPerDay:        5,
    boardOutreachPerWeek:   3,
    // Sourcing Radar settings
    sourcingRadarEnabled:           true,
    sourcingTargetIndustries:       [],
    sourcingTargetStates:           [],
    sourcingMinRelevanceThreshold:  50,
    sourcingNotifyHighPriority:     true,
    // Meeting Prep settings
    autoGeneratePrepPackets:        true,
    enableMeetingPrepAI:            true,
    prepPacketReminderHours:        24,
    // Deal Probability settings
    enableProbabilityScoring:       true,
    enableDealProbabilityCommentary: true,
    probabilityHighThreshold:       60,
    probabilityLowRescueThreshold:  30,
  },
};

// ─── Shared service context (injected into rules / jobs) ─────────────────────
const serviceCtx = {
  store,
  taskService:          TaskService,
  notificationService:  NotificationService,
  orchestrator:         AgentOrchestrator,
  uid:                  () => crypto.randomUUID(),
  nowIso:               () => new Date().toISOString(),
};

// ─── Utility helpers ──────────────────────────────────────────────────────────
function uid() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function findById(collection, id) {
  return collection.find((item) => item.id === id) ?? null;
}

// ─── Domain constants ─────────────────────────────────────────────────────────

/** Boolean fields on Company that collectively produce sellerSignalScore. */
const SELLER_SIGNAL_FIELDS = Object.freeze([
  'retirementSignal', 'noWebsiteSignal', 'reviewDeclineSignal',
  'websiteOutdatedSignal', 'hiringSlowdownSignal', 'linkedinInactiveSignal',
]);

/** Rate-limit windows and caps — single source of truth. */
const _RATE_LIMITS = Object.freeze({
  GENERAL_WINDOW_MS:  15 * 60 * 1000,   // 15 min
  GENERAL_MAX:        500,
  AI_WINDOW_MS:       60 * 1000,         // 1 min
  AI_MAX:             20,
});

/** Financial thresholds used across underwriting routes. */
const _FINANCIAL_RULES = Object.freeze({
  DSCR_MINIMUM:              1.25,
  SBA_MIN_DOWN_PAYMENT_PCT:  10,
  DEFAULT_SENIOR_RATE_PCT:   6.5,
  DEFAULT_SELLER_NOTE_RATE:  6,
});

// ─── Domain helpers ───────────────────────────────────────────────────────────

/**
 * Returns the seat type from a candidate record, tolerating both camelCase
 * (`seatType`) and legacy snake_case (`seat_type`) field names.
 * Use this everywhere instead of writing `candidateSeatType(c)`.
 *
 * @param {object} candidate
 * @returns {string}
 */
function candidateSeatType(candidate) {
  return candidate.seatType ?? candidate.seat_type ?? '';
}

/**
 * Stamps `lastInteractionAt`, `updatedAt`, `pipelinePressureLevel = 'active'`,
 * and `daysSinceLastInteraction = 0` on an entity in the given store collection.
 * Eliminates the 3× copy-paste in the POST /api/interactions handler.
 *
 * @param {object[]} collection  Reference to the store array (e.g. store.companies)
 * @param {string}   id          Entity ID to update
 * @param {string}   now         ISO timestamp string
 */
function touchEntity(collection, id, now) {
  const idx = collection.findIndex((e) => e.id === id);
  if (idx === -1) return;
  collection[idx] = {
    ...collection[idx],
    updatedAt:                now,
    lastInteractionAt:        now,
    pipelinePressureLevel:    'active',
    daysSinceLastInteraction: 0,
  };
}

// ─── Anthropic client ─────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEH_SYSTEM_PROMPT = `You are an expert M&A advisor and acquisition strategist for Dominion Edge Holdings, a search fund focused on acquiring small-to-medium owner-operated businesses in the United States via SBA 7(a) financing.

The principal is Marco Fernstaedt. You assist with:
- Business valuation and underwriting (DSCR, SDE normalization, deal structuring)
- Outreach drafting for sellers, board members, and lenders
- Due diligence checklists and LOI structuring
- Board assembly and advisory pitch scripts
- 90-day post-acquisition integration planning

Key financial rules:
- Minimum acceptable DSCR: 1.25x (SBA 7(a) requirement)
- SDE = Net Income + Owner Salary + Personal Addbacks + One-Time Adjustments
- Normalized SDE = SDE adjusted for market-rate management
- Target acquisition multiple: 3–5x SDE for Main Street businesses
- SBA 7(a) maximum: $5M, 10-year term for acquisitions

Always be direct, data-driven, and focused on execution. Do not hedge excessively.`;

function getSafeModel() {
  const model = store.settings.primaryModel || 'claude-sonnet-4-20250514';
  // Whitelist valid model IDs to prevent prompt injection
  const allowed = /^claude-(opus|sonnet|haiku)-[\w.-]+$/;
  return allowed.test(model) ? model : 'claude-sonnet-4-20250514';
}

// ─── Health ───────────────────────────────────────────────────────────────────
async function getHealthPayload() {
  const checks = { db: 'unknown', ai: 'unchecked' };
  let overallOk = true;

  // DB liveness — fast raw query
  try {
    await repo.healthPing();          // see db/repo.js — executes SELECT 1
    checks.db = 'ok';
  } catch (err) {
    checks.db = 'degraded';
    overallOk = false;
    logger.error({ err }, 'Health check: DB ping failed');
  }

  return {
    status: overallOk ? 'ok' : 'degraded',
    ts: nowIso(),
    env: NODE_ENV,
    checks,
  };
}

app.get('/health', async (req, res) => {
  const payload = await getHealthPayload();
  res.status(payload.status === 'ok' ? 200 : 503).json(payload);
});

// /api/health — accessible via frontend proxy
app.get('/api/health', async (req, res) => {
  const payload = await getHealthPayload();
  res.status(payload.status === 'ok' ? 200 : 503).json(payload);
});

// ─── AI Chat (streaming) ──────────────────────────────────────────────────────
app.post('/api/chat', validate(ChatSchema), async (req, res) => {
  const { messages, system } = req.validated;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const timeout = setTimeout(() => {
    res.write('data: [TIMEOUT]\n\n');
    res.end();
  }, 60000);

  try {
    const stream = anthropic.messages.stream({
      model: getSafeModel(),
      max_tokens: 2048,
      system: system || DEH_SYSTEM_PROMPT,
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
      if (res.writableEnded) break;
    }

    clearTimeout(timeout);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    clearTimeout(timeout);
    console.error('[/api/chat]', err.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: 'AI service error' })}\n\n`);
      res.end();
    }
  }
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
app.get('/api/dashboard/metrics', (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 86400000);

    const overdueTasks = store.tasks.filter(
      (t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < now
    ).length;

    const activeDeals = store.deals.filter((d) => d.status === 'active').length;

    const outboundWeek = store.interactions.filter(
      (i) => i.direction === 'outbound' && new Date(i.createdAt) > weekAgo
    ).length;

    const confirmedBoard = store.boardCandidates.filter((c) => c.status === 'confirmed').length;

    const allItems = store.checklistPhases.flatMap((p) => p.items || []);
    const completedItems = allItems.filter((i) => i.isComplete).length;
    const progressPct = allItems.length > 0 ? Math.round((completedItems / allItems.length) * 100) : 0;

    const needsReply = store.emailThreads.filter((t) => t.needsReply).length;

    res.json({
      overdueTasks,
      activeDeals,
      outboundWeek,
      confirmedBoard,
      progressPct,
      completedItems,
      totalItems: allItems.length,
      needsReply,
    });
  } catch (err) {
    console.error('[dashboard/metrics]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute metrics');
  }
});

app.get('/api/dashboard/next-actions', (req, res) => {
  try {
    const now = new Date();
    const actions = [];

    store.tasks
      .filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < now)
      .slice(0, 3)
      .forEach((t) => {
        actions.push({ id: `task-${t.id}`, priority: 1, label: `Overdue: ${t.title}`, href: '/tasks', type: 'task' });
      });

    store.emailThreads
      .filter((t) => t.needsReply)
      .slice(0, 2)
      .forEach((t) => {
        actions.push({ id: `email-${t.id}`, priority: 2, label: `Reply needed: ${t.subject}`, href: '/inbox', type: 'email' });
      });

    store.deals
      .filter((d) => d.status === 'active' && (now - new Date(d.updatedAt)) > 7 * 86400000)
      .slice(0, 2)
      .forEach((d) => {
        actions.push({ id: `deal-${d.id}`, priority: 3, label: `Stalled deal: ${d.companyName}`, href: `/pipeline/${d.id}`, type: 'deal' });
      });

    const boardPipeline = store.boardCandidates.filter(
      (c) => ['identified', 'researched', 'outreach_sent'].includes(c.status)
    ).length;
    if (boardPipeline > 0) {
      actions.push({ id: 'board', priority: 4, label: `${boardPipeline} board candidates need follow-up`, href: '/board', type: 'board' });
    }

    const nextItem = store.checklistPhases
      .flatMap((p) => (p.items || []).filter((i) => !i.isComplete))
      .find(Boolean);
    if (nextItem) {
      actions.push({ id: `checklist-${nextItem.id}`, priority: 5, label: `Next step: ${nextItem.title}`, href: '/checklist', type: 'checklist' });
    }

    res.json(actions.sort((a, b) => a.priority - b.priority));
  } catch (err) {
    console.error('[dashboard/next-actions]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute next actions');
  }
});

app.get('/api/dashboard/briefing', async (req, res) => {
  if (!store.settings.aiBriefingEnabled) {
    return res.json({ briefing: null, reason: 'AI briefing disabled' });
  }

  try {
    const metrics = {
      overdueTasks: store.tasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length,
      activeDeals: store.deals.filter((d) => d.status === 'active').length,
      needsReply: store.emailThreads.filter((t) => t.needsReply).length,
    };

    const message = await anthropic.messages.create({
      model: getSafeModel(),
      max_tokens: 512,
      system: DEH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generate a concise daily briefing for Marco (3-4 sentences max). Metrics: ${JSON.stringify(metrics)}. Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Top priorities only.`,
        },
      ],
    });
    res.json({ briefing: message.content[0]?.text ?? '' });
  } catch (err) {
    console.error('[dashboard/briefing]', err.message);
    errorResponse(res, 503, 'AI_UNAVAILABLE', 'AI briefing service temporarily unavailable');
  }
});

// ─── Companies ────────────────────────────────────────────────────────────────
app.get('/api/companies', asyncRoute(async (req, res) => {
  const { status, search, industry } = req.query;
  const results = await repo.companies.list({ status, search, industry }, store);
  res.json(results);
}));

app.post('/api/companies', validate(CompanySchema), asyncRoute(async (req, res) => {
  const validated = req.validated;
  const sellerSignalScore = SELLER_SIGNAL_FIELDS.filter((f) => validated[f]).length;
  const company = {
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'target',
    sellerConversationStatus: 'not_contacted',
    pipelinePressureLevel: 'active',
    daysSinceLastInteraction: 0,
    sellerSignalScore: Math.max(sellerSignalScore, validated.sellerSignalScore ?? 0),
    ...validated,
  };
  const created = await repo.companies.create(company, store);
  res.status(201).json(created);
}));

app.get('/api/companies/:id', asyncRoute(async (req, res) => {
  const company = await repo.companies.get(req.params.id, store);
  if (!company) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
  const interactions = store.interactions.filter((i) => i.companyId === req.params.id);
  const deals = store.deals.filter((d) => d.companyId === req.params.id);
  res.json({ ...company, interactions, deals });
}));

app.patch('/api/companies/:id', validate(CompanySchema.partial()), asyncRoute(async (req, res) => {
  const existing = await repo.companies.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
  const updates = { ...req.validated, updatedAt: nowIso() };
  if (SELLER_SIGNAL_FIELDS.some((f) => f in req.validated)) {
    const merged = { ...existing, ...updates };
    updates.sellerSignalScore = SELLER_SIGNAL_FIELDS.filter((f) => merged[f]).length;
  }
  const updated = await repo.companies.update(req.params.id, updates, store);
  res.json(updated);
}));

app.delete('/api/companies/:id', asyncRoute(async (req, res) => {
  const existing = await repo.companies.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
  await repo.companies.delete(req.params.id, store);
  res.status(204).end();
}));

// ─── Contacts ─────────────────────────────────────────────────────────────────
app.get('/api/contacts', asyncRoute(async (req, res) => {
  const { companyId, type, search } = req.query;
  const results = await repo.contacts.list({ companyId, contactType: type, search }, store);
  res.json(results);
}));

app.post('/api/contacts', validate(ContactSchema), asyncRoute(async (req, res) => {
  const contact = {
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    fullName: [req.validated.firstName, req.validated.lastName].filter(Boolean).join(' '),
    name:     [req.validated.firstName, req.validated.lastName].filter(Boolean).join(' '),
    ...req.validated,
  };
  const created = await repo.contacts.create(contact, store);
  res.status(201).json(created);
}));

app.get('/api/contacts/:id', asyncRoute(async (req, res) => {
  const contact = await repo.contacts.get(req.params.id, store);
  if (!contact) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
  const interactions = store.interactions.filter((i) => i.contactId === req.params.id);
  res.json({ ...contact, interactions });
}));

app.patch('/api/contacts/:id', validate(ContactSchema.partial()), asyncRoute(async (req, res) => {
  const existing = await repo.contacts.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
  const updated = await repo.contacts.update(req.params.id, { ...req.validated, updatedAt: nowIso() }, store);
  res.json(updated);
}));

// ─── Interactions ─────────────────────────────────────────────────────────────
app.get('/api/interactions', asyncRoute(async (req, res) => {
  const { companyId, contactId, dealId, interactionType } = req.query;
  const results = await repo.interactions.list({ companyId, contactId, dealId, interactionType }, store);
  res.json(results);
}));

app.post('/api/interactions', validate(InteractionSchema), asyncRoute(async (req, res) => {
  const interaction = { id: uid(), createdAt: nowIso(), ...req.validated };
  const created = await repo.interactions.create(interaction, store);

  const now = nowIso();
  if (created.companyId) touchEntity(store.companies, created.companyId, now);
  if (created.contactId) touchEntity(store.contacts,  created.contactId,  now);
  if (created.dealId)    touchEntity(store.deals,     created.dealId,     now);

  // Fire automation rules (triggers event-driven AI drafting etc.)
  AutomationRuleEngine.fire('interaction_logged', { interaction: created }, serviceCtx);

  res.status(201).json(created);
}));

// ─── Deals ────────────────────────────────────────────────────────────────────
app.get('/api/deals', asyncRoute(async (req, res) => {
  const { status, stage, companyId } = req.query;
  const results = await repo.deals.list({ status, stage, companyId }, store);
  res.json(results);
}));

app.post('/api/deals', validate(DealSchema), asyncRoute(async (req, res) => {
  const deal = {
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'active',
    stage: 'identified',
    stageEnteredAt: nowIso(),
    pipelinePressureLevel: 'active',
    daysSinceLastInteraction: 0,
    ...req.validated,
  };
  const created = await repo.deals.create(deal, store);
  res.status(201).json(created);
}));

app.get('/api/deals/:id', (req, res) => {
  try {
    const deal = findById(store.deals, req.params.id);
    if (!deal) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
    const scenarios = store.underwritingScenarios.filter((s) => s.dealId === req.params.id);
    const interactions = store.interactions.filter((i) => i.dealId === req.params.id);
    const documents = store.documents.filter((d) => d.entityId === req.params.id);
    res.json({ ...deal, scenarios, interactions, documents });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve deal');
  }
});

app.patch('/api/deals/:id', validate(DealSchema.partial()), asyncRoute(async (req, res) => {
  const existing = await repo.deals.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
  const updates = { ...req.validated, updatedAt: nowIso() };
  // Track stage entry time for velocity monitoring
  const stageChanged = updates.stage && updates.stage !== existing.stage;
  if (stageChanged) updates.stageEnteredAt = nowIso();
  const updated = await repo.deals.update(req.params.id, updates, store);
  // Fire stage-change automation (triggers AI draft etc.)
  if (stageChanged) {
    AutomationRuleEngine.fire('deal_stage_changed', { deal: updated, stage: updated.stage }, serviceCtx);
  }
  res.json(updated);
}));

// ─── Underwriting ─────────────────────────────────────────────────────────────
function calcMonthlyPayment(principal, annualRatePct, termMonths) {
  if (principal <= 0 || annualRatePct <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = termMonths;
  // Standard amortization: P * r(1+r)^n / ((1+r)^n - 1)
  const factor = Math.pow(1 + r, n);
  return (principal * r * factor) / (factor - 1);
}

app.post('/api/underwriting/calculate', validate(UnderwritingCalcSchema), (req, res) => {
  try {
    const {
      netIncome, ownerSalary, personalAddbacks, oneTimeAdjustments,
      marketRateManagement, askingPrice, downPaymentPct, sellerNotePct,
      seniorDebtRatePct, seniorDebtTermMonths, sellerNoteRatePct, sellerNoteTermMonths,
    } = req.validated;

    const grossSDE = netIncome + ownerSalary + personalAddbacks + oneTimeAdjustments;
    const normalizedSDE = grossSDE - marketRateManagement;
    const downPayment = (askingPrice * downPaymentPct) / 100;
    const sellerNoteAmount = (askingPrice * sellerNotePct) / 100;
    const seniorDebtAmount = askingPrice - downPayment - sellerNoteAmount;

    const monthlyDebtService =
      calcMonthlyPayment(seniorDebtAmount, seniorDebtRatePct, seniorDebtTermMonths) +
      calcMonthlyPayment(sellerNoteAmount, sellerNoteRatePct, sellerNoteTermMonths);

    const annualDebtService = monthlyDebtService * 12;
    const dscr = annualDebtService > 0 ? parseFloat((normalizedSDE / annualDebtService).toFixed(4)) : 0;
    const postDebtCashFlow = normalizedSDE - annualDebtService;
    const multiple = askingPrice > 0 && normalizedSDE > 0
      ? parseFloat((askingPrice / normalizedSDE).toFixed(2))
      : 0;

    const riskFlags = [];
    if (dscr > 0 && dscr < 1.25) riskFlags.push({ type: 'dscr', message: `DSCR ${dscr.toFixed(2)}x below minimum 1.25x` });
    if (multiple > 5.5) riskFlags.push({ type: 'multiple', message: `Multiple ${multiple.toFixed(1)}x above typical 3–5x range` });
    if (downPaymentPct < 10) riskFlags.push({ type: 'equity', message: 'Down payment below 10% SBA minimum' });
    if (normalizedSDE > 0 && (normalizedSDE / (askingPrice || 1)) < 0.15) riskFlags.push({ type: 'margin', message: 'SDE margin appears thin' });

    res.json({
      grossSDE, normalizedSDE, downPayment, seniorDebtAmount, sellerNoteAmount,
      monthlyDebtService, annualDebtService, dscr, postDebtCashFlow, multiple, riskFlags,
    });
  } catch (err) {
    console.error('[underwriting/calculate]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Calculation failed');
  }
});

app.get('/api/underwriting/scenarios', (req, res) => {
  try {
    const { dealId } = req.query;
    let results = [...store.underwritingScenarios];
    if (dealId && typeof dealId === 'string') results = results.filter((s) => s.dealId === dealId);
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve scenarios');
  }
});

app.post('/api/underwriting/scenarios', (req, res) => {
  try {
    const scenario = { id: uid(), createdAt: nowIso(), ...req.body };
    store.underwritingScenarios.push(scenario);
    res.status(201).json(scenario);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to save scenario');
  }
});

app.delete('/api/underwriting/scenarios/:id', (req, res) => {
  try {
    const exists = findById(store.underwritingScenarios, req.params.id);
    if (!exists) return errorResponse(res, 404, 'NOT_FOUND', 'Scenario not found');
    store.underwritingScenarios = store.underwritingScenarios.filter((s) => s.id !== req.params.id);
    res.status(204).end();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to delete scenario');
  }
});

// ─── Board ────────────────────────────────────────────────────────────────────
app.get('/api/board/seats', (_req, res) => res.json(store.boardSeats));

app.get('/api/board/candidates', (req, res) => {
  try {
    const { seatId, status } = req.query;
    let results = [...store.boardCandidates];
    if (seatId && typeof seatId === 'string') results = results.filter((c) => c.seatId === seatId);
    if (status && typeof status === 'string') results = results.filter((c) => c.status === status);
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve candidates');
  }
});

app.post('/api/board/candidates', validate(BoardCandidateSchema), (req, res) => {
  try {
    const candidate = { id: uid(), createdAt: nowIso(), updatedAt: nowIso(), status: 'identified', ...req.validated };
    store.boardCandidates.push(candidate);
    res.status(201).json(candidate);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create candidate');
  }
});

app.patch('/api/board/candidates/:id', validate(BoardCandidateSchema.partial()), (req, res) => {
  try {
    const idx = store.boardCandidates.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Candidate not found');
    store.boardCandidates[idx] = { ...store.boardCandidates[idx], ...req.validated, updatedAt: nowIso() };
    res.json(store.boardCandidates[idx]);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update candidate');
  }
});

app.get('/api/board/cap-table', (_req, res) => res.json(store.capTable));

app.post('/api/board/cap-table', (req, res) => {
  try {
    const entry = { id: uid(), createdAt: nowIso(), ...req.body };
    store.capTable.push(entry);
    res.status(201).json(entry);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to add cap table entry');
  }
});

app.delete('/api/board/cap-table/:id', (req, res) => {
  try {
    store.capTable = store.capTable.filter((e) => e.id !== req.params.id);
    res.status(204).end();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to remove cap table entry');
  }
});

// ─── Board Intelligence ───────────────────────────────────────────────────────

// GET /api/board/seats/health — board readiness score + all seat analyses
app.get('/api/board/seats/health', (req, res) => {
  try {
    const result = BoardSeatEngine.calcBoardReadinessScore(store.boardSeats, store.boardCandidates);
    res.json(result);
  } catch (err) {
    console.error('[board/seats/health]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute board seat health');
  }
});

// GET /api/board/seats/:seatType/candidates — ranked candidates for a seat
app.get('/api/board/seats/:seatType/candidates', (req, res) => {
  try {
    const { seatType } = req.params;
    const { includeScores } = req.query;
    let candidates = store.boardCandidates.filter(
      (c) => candidateSeatType(c) === seatType
    );
    if (includeScores !== 'false') {
      candidates = BoardCandidateScoring.rankCandidates(candidates, seatType);
    }
    res.json({ seat_type: seatType, ranked_candidates: candidates, total: candidates.length });
  } catch (err) {
    console.error('[board/seats/:seatType/candidates]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to rank candidates');
  }
});

// GET /api/board/candidates/:id/fit — fit score for a single candidate
app.get('/api/board/candidates/:id/fit', (req, res) => {
  try {
    const candidate = store.boardCandidates.find((c) => c.id === req.params.id);
    if (!candidate) return errorResponse(res, 404, 'NOT_FOUND', 'Candidate not found');
    const seatType = candidateSeatType(candidate) || String(req.query.seatType ?? '');
    const scored   = BoardCandidateScoring.scoreCandidateFull(candidate, seatType);
    res.json(scored);
  } catch (err) {
    console.error('[board/candidates/:id/fit]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute fit score');
  }
});

// POST /api/board/candidates/:id/rank-commentary — AI commentary on ranking
app.post('/api/board/candidates/:id/rank-commentary', async (req, res) => {
  try {
    const candidate = store.boardCandidates.find((c) => c.id === req.params.id);
    if (!candidate) return errorResponse(res, 404, 'NOT_FOUND', 'Candidate not found');
    const seatType = candidateSeatType(candidate) || String(req.body.seatType ?? '');
    const scored   = BoardCandidateScoring.scoreCandidateFull(candidate, seatType);
    const prompt   = `You are evaluating a board candidate for a ${seatType} seat.\n\nCandidate: ${candidate.name}\nFit Score: ${scored.fit_score} (${scored.fit_label})\nCommitment Probability: ${scored.commitment_probability}%\nFit Components: ${JSON.stringify(scored.fit_components)}\nBio: ${candidate.bio ?? 'Not provided'}\nNotes: ${candidate.notes ?? ''}\n\nProvide a concise (2-3 sentence) ranking commentary explaining why this candidate ranks where they do, what would improve their score, and the one best next step to advance them. Be direct and specific.`;
    const commentary = await ModelGateway.callAnthropic({ prompt, maxTokens: 300, model: 'LOW' });
    res.json({ candidate_id: candidate.id, fit_score: scored.fit_score, fit_label: scored.fit_label, commentary: commentary?.content ?? '' });
  } catch (err) {
    console.error('[board/candidates/:id/rank-commentary]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate commentary');
  }
});

// ─── Relationship Graph ───────────────────────────────────────────────────────

// GET /api/relationships/graph — adjacency summary + high-value nodes
app.get('/api/relationships/graph', (req, res) => {
  try {
    const contacts = store.contacts ?? [];
    const edges    = store.relationshipEdges ?? [];
    const highValue = RelationshipGraph.getHighValueNodes(contacts, edges, {
      limit: parseInt(req.query.limit ?? '20', 10),
      minCentrality: parseInt(req.query.minCentrality ?? '30', 10),
    });
    res.json({
      node_count:       contacts.length,
      edge_count:       edges.length,
      high_value_nodes: highValue,
    });
  } catch (err) {
    console.error('[relationships/graph]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to build relationship graph');
  }
});

// GET /api/relationships/high-value — contacts enriched with leverage scores
app.get('/api/relationships/high-value', (req, res) => {
  try {
    const contacts = store.contacts ?? [];
    const edges    = store.relationshipEdges ?? [];
    const minScore = parseInt(req.query.minScore ?? '40', 10);
    const limit    = parseInt(req.query.limit ?? '20', 10);
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const enriched = contacts
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
    console.error('[relationships/high-value]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute high-value relationships');
  }
});

// GET /api/relationships/:id/network-context — graph context for a contact
app.get('/api/relationships/:id/network-context', (req, res) => {
  try {
    const contacts = store.contacts ?? [];
    const edges    = store.relationshipEdges ?? [];
    const contact  = contacts.find((c) => c.id === req.params.id);
    if (!contact) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
    const ctx = RelationshipGraph.getNetworkContext(req.params.id, contacts, edges);
    const interactions = (store.interactions ?? []).filter((i) => i.contactId === req.params.id);
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const { centrality_score } = RelationshipGraph.calcCentrality(req.params.id, adjacency, contactMap);
    const scored = RelationshipScoring.enrichContactLeverage(contact, interactions, centrality_score);
    const nextMove = RelationshipScoring.calcNextMove(contact, interactions, ctx.can_introduce_to);
    res.json({ ...ctx, scoring: scored, next_move: nextMove });
  } catch (err) {
    console.error('[relationships/:id/network-context]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute network context');
  }
});

// POST /api/relationships/:id/next-move — compute best next move for a contact
app.post('/api/relationships/:id/next-move', (req, res) => {
  try {
    const contact = store.contacts.find((c) => c.id === req.params.id);
    if (!contact) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
    const interactions = (store.interactions ?? []).filter((i) => i.contactId === req.params.id);
    const introTargets = req.body.intro_targets ?? [];
    const result = RelationshipScoring.calcNextMove(contact, interactions, introTargets);
    res.json(result);
  } catch (err) {
    console.error('[relationships/:id/next-move]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute next move');
  }
});

// POST /api/relationships/:id/intro-request-draft — AI draft for intro request
app.post('/api/relationships/:id/intro-request-draft', async (req, res) => {
  try {
    const contact = store.contacts.find((c) => c.id === req.params.id);
    if (!contact) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
    const { target_name, target_context, reason } = req.body;
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Contact';
    const prompt = `Write a warm, professional intro request from me to ${name} asking them to introduce me to ${target_name ?? 'a specific contact'}.\n\nContext about the target: ${target_context ?? 'Not provided'}\nReason for intro: ${reason ?? 'Strategic relationship for deal or board purpose'}\nRelationship with ${name}: ${contact.relationshipWarmth ?? contact.relationship_warmth ?? 'warm'}\n\nWrite 3-4 sentences. Be direct, respectful of their time, and give them an easy out. No filler. Output only the message body.`;
    const draft = await ModelGateway.callAnthropic({ prompt, maxTokens: 250, model: 'LOW' });
    res.json({ contact_id: contact.id, target_name, draft: draft?.content ?? '' });
  } catch (err) {
    console.error('[relationships/:id/intro-request-draft]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate intro draft');
  }
});

// POST /api/relationships/edges — create a graph edge
app.post('/api/relationships/edges', validate(z.object({
  from_contact_id: z.string().min(1),
  to_contact_id:   z.string().min(1),
  edge_type:       z.enum(['knows','worked_with','introduced','advises','invested_in','referred','met_with','board_relationship','banking_relationship','legal_relationship','operator_relationship']),
  strength:        z.union([z.enum(['weak','moderate','strong','trusted']), z.number().min(0).max(10)]).optional(),
  confidence:      z.number().min(0).max(100).optional(),
  source:          z.string().max(100).optional(),
  notes:           z.string().max(2000).optional(),
  last_verified_at:z.string().datetime().optional(),
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

// GET /api/relationships/edges — list all graph edges
app.get('/api/relationships/edges', (req, res) => {
  try {
    const edges = store.relationshipEdges ?? [];
    const { from_contact_id, to_contact_id } = req.query;
    let result = edges;
    if (from_contact_id) result = result.filter((e) => e.from_contact_id === from_contact_id);
    if (to_contact_id)   result = result.filter((e) => e.to_contact_id === to_contact_id);
    res.json({ edges: result, total: result.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to list edges');
  }
});

// ─── Network Intro Paths ──────────────────────────────────────────────────────

// GET /api/network/intro-paths — find intro paths to a target
app.get('/api/network/intro-paths', (req, res) => {
  try {
    const { source_id, target_id, max_hops } = req.query;
    if (!source_id || !target_id) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'source_id and target_id are required');
    }
    const contacts  = store.contacts ?? [];
    const edges     = store.relationshipEdges ?? [];
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const result = RelationshipGraph.findIntroPaths(
      source_id, target_id, adjacency, contactMap,
      Math.min(parseInt(max_hops ?? '2', 10), 3)
    );
    res.json(result);
  } catch (err) {
    console.error('[network/intro-paths]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute intro paths');
  }
});

// POST /api/network/score-paths — score multiple intro paths in one call
app.post('/api/network/score-paths', (req, res) => {
  try {
    const { pairs } = req.body; // [{ source_id, target_id, target_name, target_type }]
    if (!Array.isArray(pairs)) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'pairs array required');
    }
    const contacts  = store.contacts ?? [];
    const edges     = store.relationshipEdges ?? [];
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const results = pairs.slice(0, 50).map(({ source_id, target_id, target_name, target_type }) => {
      const pathResult = RelationshipGraph.findIntroPaths(source_id, target_id, adjacency, contactMap);
      return { source_id, target_id, target_name, target_type, ...pathResult };
    });
    res.json({ results });
  } catch (err) {
    console.error('[network/score-paths]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to score paths');
  }
});

// GET /api/network/alerts — generate network leverage alerts
app.get('/api/network/alerts', (req, res) => {
  try {
    const contacts  = store.contacts ?? [];
    const edges     = store.relationshipEdges ?? [];
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    // Enrich contacts with leverage data
    const enrichedContacts = contacts.map((c) => {
      const { centrality_score } = RelationshipGraph.calcCentrality(c.id, adjacency, contactMap);
      const interactions = (store.interactions ?? []).filter((i) => i.contactId === c.id);
      return RelationshipScoring.enrichContactLeverage(c, interactions, centrality_score);
    });

    // Enrich investors with scoring
    const enrichedInvestors = (store.investors ?? []).map((inv) => {
      return InvestorScoring.scoreInvestorFull(inv, {}, [], 0);
    });

    // Board seat health
    const boardState = BoardSeatEngine.calcBoardReadinessScore(store.boardSeats ?? [], store.boardCandidates ?? []);

    // Credibility
    const credIdx = CredibilityIndex.calcCredibilityIndex({
      boardState,
      settings:  store.settings ?? {},
      deals:     store.deals ?? [],
      meetings:  store.meetings ?? [],
      documents: store.documents ?? [],
      investors: store.investors ?? [],
      contacts,
    });

    const result = NetworkAlerts.generateNetworkAlerts({
      contacts:        enrichedContacts,
      boardCandidates: (store.boardCandidates ?? []).map((c) =>
        BoardCandidateScoring.scoreCandidateFull(c, candidateSeatType(c))
      ),
      boardSeats:      boardState.analyzed_seats,
      investors:       enrichedInvestors,
      credibilityIndex:credIdx,
      introPathResults:[],
    });

    res.json(result);
  } catch (err) {
    console.error('[network/alerts]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate network alerts');
  }
});

// ─── Investor Scoring ─────────────────────────────────────────────────────────

// GET /api/investors/funnel — stage funnel count
app.get('/api/investors/funnel', (req, res) => {
  try {
    res.json(InvestorScoring.buildInvestorFunnel(store.investors ?? []));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to build investor funnel');
  }
});

// GET /api/investors/high-fit — ranked investors by fit + warmth
app.get('/api/investors/high-fit', (req, res) => {
  try {
    const firmContext = {
      dealSize: store.settings?.targetDealSize ?? null,
      industry: store.settings?.targetIndustry ?? null,
      stage:    store.settings?.dealStage ?? null,
      geo:      store.settings?.targetGeo ?? null,
      thesis:   store.settings?.dealThesis ?? '',
    };
    const scored = (store.investors ?? []).map((inv) =>
      InvestorScoring.scoreInvestorFull(inv, firmContext, [], 0)
    );
    const ranked = InvestorScoring.getHighFitInvestors(scored, firmContext, {
      limit:  parseInt(req.query.limit ?? '10', 10),
      minFit: parseInt(req.query.minFit ?? '60', 10),
    });
    res.json({ investors: ranked, total: ranked.length });
  } catch (err) {
    console.error('[investors/high-fit]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to rank investors');
  }
});

// GET /api/investors/:id/fit — fit score for a single investor
app.get('/api/investors/:id/fit', (req, res) => {
  try {
    const investor = (store.investors ?? []).find((i) => i.id === req.params.id);
    if (!investor) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    const firmContext = {
      dealSize: store.settings?.targetDealSize ?? null,
      industry: store.settings?.targetIndustry ?? null,
      stage:    store.settings?.dealStage ?? null,
      geo:      store.settings?.targetGeo ?? null,
      thesis:   store.settings?.dealThesis ?? '',
    };
    const interactions = (store.interactions ?? []).filter((i) => i.entityId === investor.id || i.investorId === investor.id);
    const scored = InvestorScoring.scoreInvestorFull(investor, firmContext, interactions, 0);
    res.json(scored);
  } catch (err) {
    console.error('[investors/:id/fit]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute investor fit');
  }
});

// GET /api/investors/:id/intro-paths — find intro paths to investor
app.get('/api/investors/:id/intro-paths', (req, res) => {
  try {
    const investor = (store.investors ?? []).find((i) => i.id === req.params.id);
    if (!investor) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    const { source_id } = req.query;
    if (!source_id) return errorResponse(res, 400, 'BAD_REQUEST', 'source_id query param required');
    const contacts   = store.contacts ?? [];
    const edges      = store.relationshipEdges ?? [];
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    // Investor contacts linked by name match or contact record
    const investorContactId = contacts.find(
      (c) => c.name === investor.name || c.email === investor.email
    )?.id ?? investor.id;
    const result = RelationshipGraph.findIntroPaths(source_id, investorContactId, adjacency, contactMap);
    res.json({ investor_id: investor.id, ...result });
  } catch (err) {
    console.error('[investors/:id/intro-paths]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute investor intro paths');
  }
});

// POST /api/investors/:id/outreach-draft — AI outreach draft
app.post('/api/investors/:id/outreach-draft', async (req, res) => {
  try {
    const investor = (store.investors ?? []).find((i) => i.id === req.params.id);
    if (!investor) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    const { context, tone } = req.body;
    const firmContext = {
      dealSize: store.settings?.targetDealSize,
      industry: store.settings?.targetIndustry,
      thesis:   store.settings?.dealThesis ?? '',
    };
    const scored = InvestorScoring.scoreInvestorFull(investor, firmContext, [], 0);
    const prompt = `Write a personalized first-touch outreach email to ${investor.name} (${investor.organization ?? ''}) for a search fund acquisition.\n\nInvestor type: ${investor.investorType}\nFit score: ${scored.fit_score} (${scored.fit_label})\nWarmth: ${scored.warmth_state}\nTone: ${tone ?? 'professional and direct'}\nContext: ${context ?? 'Looking to raise equity for a small business acquisition'}\nIndustries preferred: ${(investor.industriesPreferred ?? []).join(', ') || 'general'}\n\nWrite subject line + email body. 4-6 sentences. No filler. End with a clear ask.`;
    const draft = await ModelGateway.callAnthropic({ prompt, maxTokens: 400, model: 'MID' });
    res.json({ investor_id: investor.id, fit_score: scored.fit_score, warmth_state: scored.warmth_state, draft: draft?.content ?? '' });
  } catch (err) {
    console.error('[investors/:id/outreach-draft]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate outreach draft');
  }
});

// POST /api/investors/:id/memo-section-draft — AI memo section for an investor
app.post('/api/investors/:id/memo-section-draft', async (req, res) => {
  try {
    const investor = (store.investors ?? []).find((i) => i.id === req.params.id);
    if (!investor) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    const { section, dealContext } = req.body;
    const scored = InvestorScoring.scoreInvestorFull(investor, {}, [], 0);
    const prompt = `Write the "${section ?? 'investor summary'}" section of an investor memo targeting ${investor.name}.\n\nInvestor profile: ${investor.investorType}, check size $${investor.checkSizeMin ?? '?'}–$${investor.checkSizeMax ?? '?'}, industries: ${(investor.industriesPreferred ?? []).join(', ') || 'general'}\nFit score: ${scored.fit_score}\nDeal context: ${dealContext ?? store.settings?.dealThesis ?? 'SMB acquisition in target industry'}\n\nWrite 2-3 tight paragraphs. Tailored to this investor's profile. No filler.`;
    const draft = await ModelGateway.callAnthropic({ prompt, maxTokens: 500, model: 'MID' });
    res.json({ investor_id: investor.id, section: section ?? 'investor_summary', draft: draft?.content ?? '' });
  } catch (err) {
    console.error('[investors/:id/memo-section-draft]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate memo section');
  }
});

// ─── Credibility Index ────────────────────────────────────────────────────────

// GET /api/credibility — firm credibility index
app.get('/api/credibility', (req, res) => {
  try {
    const boardState = BoardSeatEngine.calcBoardReadinessScore(store.boardSeats ?? [], store.boardCandidates ?? []);
    const result = CredibilityIndex.calcCredibilityIndex({
      boardState,
      settings:  store.settings ?? {},
      deals:     store.deals ?? [],
      meetings:  store.meetings ?? [],
      documents: store.documents ?? [],
      investors: store.investors ?? [],
      contacts:  store.contacts ?? [],
      thesisText:store.settings?.dealThesis ?? '',
    });
    res.json(result);
  } catch (err) {
    console.error('[credibility]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute credibility index');
  }
});

// ─── Command Center Network Summary ───────────────────────────────────────────

// GET /api/command-center/network — full network intelligence summary for command center
app.get('/api/command-center/network', (req, res) => {
  try {
    const contacts  = store.contacts ?? [];
    const edges     = store.relationshipEdges ?? [];
    const adjacency  = RelationshipGraph.buildAdjacencyMap(edges);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    const enrichedContacts = contacts.map((c) => {
      const { centrality_score } = RelationshipGraph.calcCentrality(c.id, adjacency, contactMap);
      const interactions = (store.interactions ?? []).filter((i) => i.contactId === c.id);
      return RelationshipScoring.enrichContactLeverage(c, interactions, centrality_score);
    });

    const firmContext = {
      dealSize: store.settings?.targetDealSize ?? null,
      industry: store.settings?.targetIndustry ?? null,
      thesis:   store.settings?.dealThesis ?? '',
    };
    const enrichedInvestors = (store.investors ?? []).map((inv) =>
      InvestorScoring.scoreInvestorFull(inv, firmContext, [], 0)
    );

    const boardState = BoardSeatEngine.calcBoardReadinessScore(store.boardSeats ?? [], store.boardCandidates ?? []);
    const credIdx    = CredibilityIndex.calcCredibilityIndex({
      boardState, settings: store.settings ?? {},
      deals: store.deals ?? [], meetings: store.meetings ?? [],
      documents: store.documents ?? [], investors: store.investors ?? [],
      contacts, thesisText: store.settings?.dealThesis ?? '',
    });

    const scoredCandidates = (store.boardCandidates ?? []).map((c) =>
      BoardCandidateScoring.scoreCandidateFull(c, candidateSeatType(c))
    );

    const summary = NetworkAlerts.buildCommandCenterSummary({
      boardState,
      contacts:        enrichedContacts,
      boardCandidates: scoredCandidates,
      boardSeats:      boardState.analyzed_seats,
      investors:       enrichedInvestors,
      credibilityIndex:credIdx,
      introPathResults:[],
    });

    // Ensure credibility_index is the full object (not just score number)
    if (typeof summary.credibility_index === 'number') {
      summary.credibility_index = credIdx;
    }
    res.json(summary);
  } catch (err) {
    console.error('[command-center/network]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to build command center network summary');
  }
});

// ─── Investor Readiness Gaps ──────────────────────────────────────────────────

// GET /api/investors/readiness-gaps — what's missing before serious outreach
app.get('/api/investors/readiness-gaps', (req, res) => {
  try {
    const s = store.settings ?? {};
    const documents = store.documents ?? [];
    const deals     = store.deals ?? [];

    const credIdx    = CredibilityIndex.quickCredibilityEstimate(store);

    const firmContext = {
      hasThesis:     !!(s.dealThesis || s.thesis),
      hasDeal:       deals.some((d) => !['lost', 'identified'].includes(d.stage ?? d.status ?? '')),
      hasMemo:       documents.some((d) => d.documentType === 'deal_memo') || (store.investorMemos ?? []).length > 0,
      hasTraction:   (store.meetings ?? []).filter((m) => ['banker_intro','capital_intro'].includes(m.meetingType ?? '')).length > 0,
      hasAsk:        !!(s.askAmount || s.targetDealSize),
      hasIntro:      (store.relationshipEdges ?? []).length > 0,
      credibilityScore: credIdx.score,
    };

    const gaps = InvestorScoring.calcInvestorReadinessGaps(firmContext);
    res.json({ ...gaps, firm_context: firmContext, credibility_score: credIdx.score, credibility_label: credIdx.label });
  } catch (err) {
    console.error('[investors/readiness-gaps]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute readiness gaps');
  }
});

// ─── Checklist ────────────────────────────────────────────────────────────────
app.get('/api/checklist', (_req, res) => res.json(store.checklistPhases));

app.patch('/api/checklist/items/:itemId/complete', (req, res) => {
  try {
    const { itemId } = req.params;
    const isComplete = req.body?.isComplete ?? true;

    if (typeof isComplete !== 'boolean') {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'isComplete must be a boolean');
    }

    let found = false;
    for (const phase of store.checklistPhases) {
      const item = (phase.items || []).find((i) => i.id === itemId);
      if (item) {
        item.isComplete = isComplete;
        item.completedAt = isComplete ? nowIso() : undefined;
        found = true;
        break;
      }
    }

    if (!found) return errorResponse(res, 404, 'NOT_FOUND', 'Checklist item not found');
    res.json({ ok: true });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update checklist item');
  }
});

// ─── Tasks ────────────────────────────────────────────────────────────────────
app.get('/api/tasks', asyncRoute(async (req, res) => {
  const { status, priority, companyId, dealId } = req.query;
  const results = await repo.tasks.list({ status, priority, companyId, dealId }, store);
  res.json(results);
}));

app.post('/api/tasks', validate(TaskSchema), asyncRoute(async (req, res) => {
  const task = {
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'todo',
    priority: 'medium',
    ...req.validated,
  };
  const created = await repo.tasks.create(task, store);
  res.status(201).json(created);
}));

app.patch('/api/tasks/:id', validate(TaskSchema.partial()), asyncRoute(async (req, res) => {
  const existing = await repo.tasks.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');
  const updates = { ...req.validated, updatedAt: nowIso() };
  if (updates.status === 'done' && !existing.completedAt) {
    updates.completedAt = nowIso();
  }
  const updated = await repo.tasks.update(req.params.id, updates, store);
  res.json(updated);
}));

app.delete('/api/tasks/:id', asyncRoute(async (req, res) => {
  const existing = await repo.tasks.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');
  await repo.tasks.delete(req.params.id, store);
  res.status(204).end();
}));

// ─── Inbox ────────────────────────────────────────────────────────────────────
app.get('/api/inbox/threads', (req, res) => {
  try {
    const { needsReply, status } = req.query;
    let results = [...store.emailThreads];
    if (needsReply === 'true') results = results.filter((t) => t.needsReply);
    if (status && typeof status === 'string') results = results.filter((t) => t.status === status);
    results.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve threads');
  }
});

app.get('/api/inbox/threads/:id', (req, res) => {
  try {
    const thread = findById(store.emailThreads, req.params.id);
    if (!thread) return errorResponse(res, 404, 'NOT_FOUND', 'Thread not found');
    res.json(thread);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve thread');
  }
});

app.post('/api/inbox/compose', validate(ComposeSchema), (req, res) => {
  try {
    const thread = {
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: 'sent',
      direction: 'outbound',
      needsReply: false,
      subject: req.validated.subject,
      messages: [
        {
          id: uid(),
          from: store.settings.fromEmail || 'marco@dominionedge.com',
          to: req.validated.to,
          subject: req.validated.subject,
          body: req.validated.body || '',
          sentAt: nowIso(),
          direction: 'outbound',
        },
      ],
      ...req.validated,
    };
    store.emailThreads.push(thread);

    if (req.validated.companyId) {
      store.interactions.push({
        id: uid(),
        companyId: req.validated.companyId,
        contactId: req.validated.contactId || undefined,
        type: 'email',
        direction: 'outbound',
        subject: req.validated.subject,
        notes: req.validated.body,
        createdAt: nowIso(),
      });
    }

    res.status(201).json(thread);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compose email');
  }
});

// ─── Outreach / AI Drafting ───────────────────────────────────────────────────
app.get('/api/outreach/templates', (req, res) => {
  try {
    const { templateType } = req.query;
    let results = [...(store.outreachTemplates || [])];
    if (templateType && typeof templateType === 'string') results = results.filter((t) => t.templateType === templateType);
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve templates');
  }
});

app.post('/api/outreach/generate', validate(OutreachGenerateSchema), async (req, res) => {
  if (!store.settings.aiDraftingEnabled) {
    return errorResponse(res, 403, 'FEATURE_DISABLED', 'AI drafting is disabled in settings');
  }

  const { templateType, companyName, ownerName, context } = req.validated;
  const typeDescriptions = {
    seller_outreach: 'initial cold outreach to a business owner exploring acquisition',
    seller_follow_up: 'warm follow-up to a seller who has not responded',
    board_outreach: 'invitation to join an acquisition advisory board',
    lender_outreach: 'introduction to a lender for SBA 7(a) financing',
    networking_outreach: 'networking message for deal sourcing',
  };

  try {
    const message = await anthropic.messages.create({
      model: getSafeModel(),
      max_tokens: 1024,
      system: DEH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Draft a personalized ${typeDescriptions[templateType]} email.\nCompany: ${companyName || '[Company]'}\nOwner: ${ownerName || '[Owner]'}\nFrom: Marco Fernstaedt, Dominion Edge Holdings\nContext: ${context || 'None'}\n\nReturn JSON only: {"subject": "...", "body": "..."}`,
        },
      ],
    });

    const text = message.content[0]?.text ?? '';
    try {
      const match = text.match(/\{[\s\S]*\}/);
      const json = match ? JSON.parse(match[0]) : {};
      res.json({ subject: json.subject || '', body: json.body || text });
    } catch {
      res.json({ subject: `Inquiry: ${companyName || 'Your Business'}`, body: text });
    }
  } catch (err) {
    console.error('[outreach/generate]', err.message);
    errorResponse(res, 503, 'AI_UNAVAILABLE', 'AI drafting service temporarily unavailable');
  }
});

// ─── Documents ────────────────────────────────────────────────────────────────
app.get('/api/documents', (req, res) => {
  try {
    const { entityId, documentType } = req.query;
    let results = [...store.documents];
    if (entityId && typeof entityId === 'string') results = results.filter((d) => d.entityId === entityId);
    if (documentType && typeof documentType === 'string') results = results.filter((d) => d.documentType === documentType);
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve documents');
  }
});

app.post('/api/documents', validate(DocumentSchema), (req, res) => {
  try {
    const doc = {
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: 'draft',
      version: 1,
      source: 'template',
      generatedBy: 'system',
      ...req.validated,
    };
    store.documents.push(doc);
    res.status(201).json(doc);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create document');
  }
});

app.get('/api/documents/:id', (req, res) => {
  try {
    const doc = findById(store.documents, req.params.id);
    if (!doc) return errorResponse(res, 404, 'NOT_FOUND', 'Document not found');
    res.json(doc);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve document');
  }
});

// ─── Reports ──────────────────────────────────────────────────────────────────
app.get('/api/reports/summary', (_req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const allItems = store.checklistPhases.flatMap((p) => p.items || []);
    const completedItems = allItems.filter((i) => i.isComplete).length;

    res.json({
      overview: {
        progressPct: allItems.length > 0 ? Math.round((completedItems / allItems.length) * 100) : 0,
        completedItems,
        totalItems: allItems.length,
      },
      tasks: {
        total: store.tasks.length,
        open: store.tasks.filter((t) => t.status !== 'done' && t.status !== 'archived').length,
        completedThisWeek: store.tasks.filter((t) => t.status === 'done' && t.completedAt && new Date(t.completedAt) > weekAgo).length,
        overdue: store.tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < now).length,
      },
      crm: {
        companies: store.companies.length,
        companiesThisWeek: store.companies.filter((c) => new Date(c.createdAt) > weekAgo).length,
        contacts: store.contacts.length,
        interactions: store.interactions.length,
        outboundThisWeek: store.interactions.filter((i) => i.direction === 'outbound' && new Date(i.createdAt) > weekAgo).length,
        inboundThisWeek: store.interactions.filter((i) => i.direction === 'inbound' && new Date(i.createdAt) > weekAgo).length,
      },
      pipeline: {
        total: store.deals.length,
        active: store.deals.filter((d) => d.status === 'active').length,
        closed: store.deals.filter((d) => d.status === 'closed').length,
        stalled: store.deals.filter((d) => d.status === 'active' && (now.getTime() - new Date(d.updatedAt).getTime()) > 7 * 86400000).length,
      },
      board: {
        confirmed: store.boardCandidates.filter((c) => c.status === 'confirmed').length,
        pipeline: store.boardCandidates.filter((c) =>
          ['identified', 'researched', 'outreach_sent', 'meeting_scheduled', 'interested', 'negotiating'].includes(c.status)
        ).length,
        total: store.boardCandidates.length,
      },
      underwriting: {
        scenarios: store.underwritingScenarios.length,
        passingDSCR: store.underwritingScenarios.filter((s) => s.dscr >= 1.25).length,
        bestDSCR: store.underwritingScenarios.reduce((best, s) => Math.max(best, s.dscr || 0), 0),
      },
      documents: { total: store.documents.length },
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate report');
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', (_req, res) => {
  // Never return passwords or internal-only values
  const { smtpPassword: _smtpPassword, ...safeSettings } = store.settings;
  res.json(safeSettings);
});

app.patch('/api/settings', validate(SettingsPatchSchema), (req, res) => {
  try {
    // Credentials must never be accepted from API clients
    const { smtpPassword: _smtpPassword, ...safeUpdates } = req.validated;
    store.settings = { ...store.settings, ...safeUpdates };
    IntegrationRegistry.syncFromSettings(store.settings);
    const { smtpPassword: _, ...safeSettings } = store.settings;
    res.json(safeSettings);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update settings');
  }
});

// ─── AI Reply Suggestion ──────────────────────────────────────────────────────

app.post('/api/ai/reply-suggestion', validate(ReplySuggestionSchema), async (req, res) => {
  if (!store.settings.aiReplyEnabled) {
    return errorResponse(res, 403, 'FEATURE_DISABLED', 'AI reply suggestions are disabled in settings');
  }

  const { threadSubject, lastMessage, senderName, companyName } = req.validated;

  try {
    const message = await anthropic.messages.create({
      model: getSafeModel(),
      max_tokens: 512,
      system: DEH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Suggest a brief reply.\nSender: ${senderName || 'Unknown'}\nCompany: ${companyName || 'Unknown'}\nSubject: ${threadSubject || ''}\nMessage: "${lastMessage}"\n\nReturn JSON only: {"subject": "Re: ...", "body": "..."}. Under 100 words.`,
        },
      ],
    });

    const text = message.content[0]?.text ?? '';
    try {
      const match = text.match(/\{[\s\S]*\}/);
      const json = match ? JSON.parse(match[0]) : {};
      res.json({ subject: json.subject || `Re: ${threadSubject}`, body: json.body || text });
    } catch {
      res.json({ subject: `Re: ${threadSubject || ''}`, body: text });
    }
  } catch (err) {
    console.error('[ai/reply-suggestion]', err.message);
    errorResponse(res, 503, 'AI_UNAVAILABLE', 'AI service temporarily unavailable');
  }
});

// ─── Meetings ────────────────────────────────────────────────────────────────

store.meetings = [];

app.get('/api/meetings', (req, res) => {
  try {
    const { status, upcoming } = req.query;
    let results = [...store.meetings];
    if (status && typeof status === 'string') results = results.filter((m) => m.status === status);
    if (upcoming === 'true') {
      const now = new Date();
      results = results.filter((m) => new Date(m.startsAt) > now && !['completed', 'cancelled'].includes(m.status));
    }
    results.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve meetings');
  }
});

app.post('/api/meetings', validate(MeetingSchema), (req, res) => {
  try {
    const meeting = {
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      source: 'manual',
      status: 'draft',
      linkedContactIds: [],
      proposedSlots: [],
      followUpTaskCreated: false,
      prepTaskCreated: false,
      ...req.validated,
    };
    store.meetings.push(meeting);
    res.status(201).json(meeting);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create meeting');
  }
});

app.get('/api/meetings/upcoming', (req, res) => {
  try {
    const now = new Date();
    const results = store.meetings
      .filter((m) => new Date(m.startsAt) > now && !['completed', 'cancelled'].includes(m.status))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve upcoming meetings');
  }
});

app.get('/api/meetings/:id', (req, res) => {
  try {
    const meeting = findById(store.meetings, req.params.id);
    if (!meeting) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    res.json(meeting);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve meeting');
  }
});

app.patch('/api/meetings/:id', validate(MeetingSchema.partial()), (req, res) => {
  try {
    const idx = store.meetings.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    store.meetings[idx] = { ...store.meetings[idx], ...req.validated, updatedAt: nowIso() };
    res.json(store.meetings[idx]);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update meeting');
  }
});

const _MEETING_STATUS_TRANSITIONS = {
  draft: ['proposed', 'confirmed', 'cancelled'],
  proposed: ['awaiting_confirmation', 'confirmed', 'cancelled'],
  awaiting_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['scheduled', 'cancelled', 'rescheduled'],
  scheduled: ['completed', 'cancelled', 'no_show', 'rescheduled'],
  completed: [],
  cancelled: [],
  rescheduled: ['confirmed', 'scheduled'],
  no_show: [],
};

app.post('/api/meetings/:id/confirm', (req, res) => {
  try {
    const idx = store.meetings.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    store.meetings[idx] = { ...store.meetings[idx], status: 'confirmed', updatedAt: nowIso() };
    res.json(store.meetings[idx]);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to confirm meeting');
  }
});

app.post('/api/meetings/:id/schedule', (req, res) => {
  try {
    const idx = store.meetings.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    store.meetings[idx] = { ...store.meetings[idx], status: 'scheduled', updatedAt: nowIso() };
    res.json(store.meetings[idx]);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to schedule meeting');
  }
});

app.post('/api/meetings/:id/complete', (req, res) => {
  try {
    const idx = store.meetings.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    store.meetings[idx] = {
      ...store.meetings[idx],
      status: 'completed',
      completedAt: nowIso(),
      updatedAt: nowIso(),
      summary: req.body?.summary || undefined,
    };
    res.json(store.meetings[idx]);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to complete meeting');
  }
});

app.post('/api/meetings/:id/cancel', (req, res) => {
  try {
    const idx = store.meetings.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    store.meetings[idx] = {
      ...store.meetings[idx],
      status: 'cancelled',
      cancelledAt: nowIso(),
      updatedAt: nowIso(),
    };
    res.json(store.meetings[idx]);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to cancel meeting');
  }
});

app.post('/api/meetings/:id/generate-agenda', async (req, res) => {
  try {
    const meeting = findById(store.meetings, req.params.id);
    if (!meeting) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');

    const linkedCompany = meeting.linkedCompanyId
      ? findById(store.companies, meeting.linkedCompanyId)
      : null;

    const message = await anthropic.messages.create({
      model: getSafeModel(),
      max_tokens: 512,
      system: DEH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generate a concise meeting agenda for a ${meeting.meetingType.replace(/_/g, ' ')} call.
Title: ${meeting.title}
Company: ${linkedCompany?.name || 'Not specified'}
Duration: ${meeting.durationMinutes} minutes
Notes: ${meeting.meetingNotes || 'None'}

Return a numbered list of agenda items only. Be specific and actionable.`,
        },
      ],
    });

    const agenda = message.content[0]?.text ?? '';
    res.json({ agenda });
  } catch (err) {
    console.error('[meetings/generate-agenda]', err.message);
    errorResponse(res, 503, 'AI_UNAVAILABLE', 'AI service temporarily unavailable');
  }
});

// ─── Agent routes ─────────────────────────────────────────────────────────────

// ─── Agent execution helper (all routes via AgentOrchestrator) ───────────────
async function runAgent(agentName, input, req, res) {
  try {
    const result = await AgentOrchestrator.run(agentName, { ...input, costFlags: store.settings });
    res.json(result);
  } catch (err) {
    const code = err.code === 'FEATURE_DISABLED' ? 'FEATURE_DISABLED' : 'AI_UNAVAILABLE';
    const status = err.code === 'FEATURE_DISABLED' ? 402 : 503;
    console.error(`[agents/${agentName}]`, err.message);
    errorResponse(res, status, code, err.message);
  }
}

// POST /api/agents/analyze-response
app.post('/api/agents/analyze-response', validate(ResponseAnalysisSchema), (req, res) =>
  runAgent('ResponseAnalysisAgent', req.validated, req, res));

// POST /api/agents/schedule-meeting
app.post('/api/agents/schedule-meeting', validate(CalendarSchedulingSchema), (req, res) =>
  runAgent('CalendarSchedulingAgent', req.validated, req, res));

// POST /api/agents/daily-briefing
app.post('/api/agents/daily-briefing', validate(DailyOperationsSchema), (req, res) =>
  runAgent('DailyOperationsAgent', {
    pipeline: store.deals, tasks: store.tasks, meetings: store.meetings, date: req.validated.date,
  }, req, res));

// POST /api/agents/board-analysis
app.post('/api/agents/board-analysis', validate(BoardBuilderSchema), (req, res) =>
  runAgent('BoardBuilderAgent', {
    candidates: store.boardCandidates, currentSeats: store.boardSeats,
    targetIndustry: req.validated.targetIndustry, dealContext: req.validated.dealContext,
  }, req, res));

// POST /api/agents/generate-outreach
app.post('/api/agents/generate-outreach', validate(OutreachGenerationSchema), (req, res) =>
  runAgent('OutreachGenerationAgent', req.validated, req, res));

// POST /api/agents/analyze-deal
app.post('/api/agents/analyze-deal', validate(DealAnalysisSchema), (req, res) => {
  const { companyId, financials, notes } = req.validated;
  const company = companyId ? findById(store.companies, companyId) : null;
  return runAgent('DealAnalysisAgent', { company, financials, notes }, req, res);
});

// POST /api/agents/crm-health
app.post('/api/agents/crm-health', validate(z.object({ model: AgentModelSchema })), (req, res) =>
  runAgent('CRMStewardAgent', {
    companies: store.companies, contacts: store.contacts, interactions: store.interactions,
  }, req, res));

// POST /api/agents/lead-discovery
app.post('/api/agents/lead-discovery', validate(LeadDiscoverySchema), (req, res) =>
  runAgent('LeadDiscoveryAgent', {
    ...req.validated,
    currentPipelineCount: store.deals.filter((d) => d.status === 'active').length,
  }, req, res));

// POST /api/agents/qualify-target
app.post('/api/agents/qualify-target', validate(TargetQualificationSchema), (req, res) => {
  const { companyId, researchNotes, linkedinData, websiteSignals } = req.validated;
  const company = companyId ? findById(store.companies, companyId) : null;
  return runAgent('TargetQualificationAgent', { company, researchNotes, linkedinData, websiteSignals }, req, res);
});

// POST /api/agents/strategy-advice
app.post('/api/agents/strategy-advice', validate(StrategyAdvisorSchema), (req, res) => {
  const { question, context, dealId } = req.validated;
  const deal = dealId ? findById(store.deals, dealId) : null;
  const dealData = deal ? { ...deal, company: findById(store.companies, deal.companyId) } : null;
  return runAgent('StrategyAdvisorAgent', { question, context, dealData }, req, res);
});

// GET /api/agents — list all agents with model routing
app.get('/api/agents', (_req, res) => {
  res.json({
    agents: AgentOrchestrator.listAgents(),
    modelRoutes: AIService.listRoutes(),
  });
});

// ─── Service API routes ───────────────────────────────────────────────────────

// GET /api/services/deal/stages — deterministic stage list
app.get('/api/services/deal/stages', (_req, res) => {
  res.json({ stages: DealService.DEAL_STAGES });
});

// POST /api/services/deal/dscr — deterministic DSCR calculation
app.post('/api/services/deal/dscr', validate(z.object({
  netOperatingIncome: z.number(),
  annualDebtService:  z.number().positive(),
})), (req, res) => {
  const { netOperatingIncome, annualDebtService } = req.validated;
  const dscr = DealService.calculateDSCR(netOperatingIncome, annualDebtService);
  res.json({ dscr, meetsThreshold: dscr >= 1.25, threshold: 1.25 });
});

// POST /api/services/deal/loan-payment — deterministic SBA payment calc
app.post('/api/services/deal/loan-payment', validate(z.object({
  principal:   z.number().positive(),
  annualRate:  z.number().min(0).max(1),
  termYears:   z.number().int().min(1).max(30),
})), (req, res) => {
  const { principal, annualRate, termYears } = req.validated;
  res.json({
    monthlyPayment: DealService.monthlyLoanPayment(principal, annualRate, termYears),
    annualDebtService: DealService.annualDebtService(principal, annualRate, termYears),
    totalCost: +(DealService.monthlyLoanPayment(principal, annualRate, termYears) * termYears * 12).toFixed(2),
  });
});

// POST /api/services/deal/valuation — deterministic valuation range
app.post('/api/services/deal/valuation', validate(z.object({
  sde:          z.number().min(0).optional(),
  ebitda:       z.number().min(0).optional(),
  industryType: z.enum(['service', 'industrial', 'distribution', 'software', 'default']).optional(),
})), (req, res) => {
  const { sde, ebitda, industryType } = req.validated;
  res.json(DealService.estimateValuationRange(sde, ebitda, industryType));
});

// GET /api/services/crm/duplicates — deterministic duplicate detection
app.get('/api/services/crm/duplicates', (_req, res) => {
  try {
    const duplicates = CRMService.findDuplicates(store.contacts);
    res.json({ duplicates, count: duplicates.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to detect duplicates');
  }
});

// GET /api/services/tasks/overdue — deterministic overdue detection
app.get('/api/services/tasks/overdue', (_req, res) => {
  res.json({ overdue: TaskService.detectOverdue(store.tasks) });
});

// ─── Automation routes ────────────────────────────────────────────────────────

// GET /api/automation/rules
app.get('/api/automation/rules', (_req, res) => {
  res.json({ rules: AutomationRuleEngine.listRules() });
});

// PATCH /api/automation/rules/:id
app.patch('/api/automation/rules/:id', validate(z.object({ enabled: z.boolean() })), (req, res) => {
  AutomationRuleEngine.setEnabled(req.params.id, req.validated.enabled);
  const rules = AutomationRuleEngine.listRules();
  const rule  = rules.find((r) => r.id === req.params.id);
  if (!rule) return errorResponse(res, 404, 'NOT_FOUND', 'Rule not found');
  res.json(rule);
});

// GET /api/automation/jobs
app.get('/api/automation/jobs', (_req, res) => {
  res.json({ jobs: BackgroundJobRunner.status() });
});

// POST /api/automation/jobs/:id/trigger
app.post('/api/automation/jobs/:id/trigger', async (req, res) => {
  try {
    await BackgroundJobRunner.trigger(req.params.id);
    res.json({ triggered: true, jobId: req.params.id });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Failed to trigger job: ${err.message}`);
  }
});

// ─── Audit log routes ─────────────────────────────────────────────────────────

// GET /api/audit — query audit log
app.get('/api/audit', (req, res) => {
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

// ─── Cache diagnostic routes ──────────────────────────────────────────────────

// GET /api/cache/stats
app.get('/api/cache/stats', (_req, res) => {
  res.json({ entries: CacheService.size() });
});

// ─── AI cost & run analytics routes ──────────────────────────────────────────

// GET /api/ai/cost-summary — usage, cost, cache hit rate
app.get('/api/ai/cost-summary', (_req, res) => {
  try {
    const summary = CostControlService.getUsageSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/runs — recent agent run logs
app.get('/api/ai/runs', (req, res) => {
  try {
    const { agent_name, task_type, fallback_only, errors_only, limit, offset } = req.query;
    const result = AgentRunLogger.getRuns({
      agent_name:    agent_name || null,
      task_type:     task_type  || null,
      fallback_only: fallback_only === 'true',
      errors_only:   errors_only  === 'true',
      limit:         Math.min(Number(limit)  || 50, 200),
      offset:        Number(offset) || 0,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/metrics — system-wide quality metrics
app.get('/api/ai/metrics', (_req, res) => {
  try {
    res.json(AgentRunLogger.getSystemMetrics());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/prompt-registry — list all registered prompts
app.get('/api/ai/prompt-registry', (_req, res) => {
  try {
    res.json({ prompts: PromptRegistry.listPromptKeys() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/task-routes — full task → tier → model routing table
app.get('/api/ai/task-routes', (_req, res) => {
  try {
    res.json({ routes: ModelGateway.listTaskRoutes(), providers: ModelGateway.getProviderModels() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Approval routes ──────────────────────────────────────────────────────────

// ─── Approval routes ──────────────────────────────────────────────────────────

// GET /api/approvals — list with optional filters
app.get('/api/approvals', (req, res) => {
  const { status, artifactType, actionType, approvalScope, entityId, recipientType, limit, offset } = req.query;
  try {
    res.json(ApprovalService.query({
      status, artifactType, actionType, approvalScope, entityId, recipientType,
      limit:  Math.min(Number(limit) || 50, 200),
      offset: Number(offset) || 0,
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/approvals/:id
app.get('/api/approvals/:id', (req, res) => {
  const rec = ApprovalService.getById(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Approval not found' });
  res.json(rec);
});

// GET /api/approvals/:id/history
app.get('/api/approvals/:id/history', (req, res) => {
  try {
    res.json(ApprovalService.getHistory(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/approvals/:id/staleness
app.get('/api/approvals/:id/staleness', (req, res) => {
  try {
    const warning = ApprovalService.getStalenessWarning(req.params.id);
    res.json({ stale: Boolean(warning), warning });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/approvals/:id/submit
app.post('/api/approvals/:id/submit', (req, res) => {
  try {
    const rec = ApprovalService.submit(req.params.id, { submittedBy: req.body?.submitted_by ?? 'user' });
    res.json(rec);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/approvals/:id/approve
app.post('/api/approvals/:id/approve', validate(z.object({ notes: z.string().max(500).optional() })), (req, res) => {
  try {
    const rec = ApprovalService.approve(req.params.id, { notes: req.validated.notes });
    res.json(rec);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/approvals/:id/reject  — reason is required
app.post('/api/approvals/:id/reject', validate(z.object({ reason: z.string().min(1).max(500) })), (req, res) => {
  try {
    const rec = ApprovalService.reject(req.params.id, { reason: req.validated.reason });
    res.json(rec);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/approvals/:id/revise  — instructions required
app.post('/api/approvals/:id/revise', validate(z.object({ instructions: z.string().min(1).max(1000) })), (req, res) => {
  try {
    const rec = ApprovalService.requestRevision(req.params.id, { instructions: req.validated.instructions });
    res.json(rec);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/approvals/:id/apply  — apply an approved draft
app.post('/api/approvals/:id/apply', (req, res) => {
  try {
    const rec = ApprovalService.apply(req.params.id, { appliedBy: req.body?.applied_by ?? 'user' });
    res.json(rec);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Artifact routes ──────────────────────────────────────────────────────────

// GET /api/artifacts — query with filters
app.get('/api/artifacts', (req, res) => {
  const { artifactType, artifactStatus, approvalStatus, linkedEntityId, generatedByAgent, approvalRequired, latestOnly, limit, offset } = req.query;
  try {
    const result = ArtifactStore.query({
      artifactType:     artifactType ?? req.query.type,
      artifactStatus:   artifactStatus,
      approvalStatus:   approvalStatus,
      linkedEntityId,
      generatedByAgent,
      approvalRequired: approvalRequired !== undefined ? approvalRequired === 'true' : null,
      latestOnly:       latestOnly !== 'false',
      limit:            Math.min(Number(limit) || 50, 200),
      offset:           Number(offset) || 0,
    });
    // Normalise: wrap in { artifacts, total } if ArtifactStore returns a plain array
    if (Array.isArray(result)) {
      res.json({ artifacts: result, total: result.length });
    } else if (result && Array.isArray(result.artifacts)) {
      res.json(result);
    } else {
      const items = result?.items ?? result?.results ?? [];
      res.json({ artifacts: items, total: items.length });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/artifacts — create a new artifact (accepts both camelCase and snake_case)
app.post('/api/artifacts', validate(z.object({
  // snake_case aliases (test-facing)
  type:              z.string().min(1).optional(),
  // camelCase fields (original)
  artifactType:      z.string().min(1).optional(),
  title:             z.string().min(1).max(300),
  linkedEntityTypes: z.array(z.string()).optional().default([]),
  linkedEntityIds:   z.array(z.string()).optional().default([]),
  content:           z.any(),
  format:            z.enum(['json', 'markdown', 'text']).optional().default('json'),
  generatedByAgent:  z.string().optional(),
  promptKey:         z.string().optional(),
  promptVersion:     z.string().optional(),
  approvalRequired:  z.boolean().optional().default(false),
  groupId:           z.string().optional(),
  staleHours:        z.number().optional(),
}).refine((d) => d.type || d.artifactType, { message: 'type is required', path: ['type'] })), (req, res) => {
  try {
    const data = req.validated;
    const artifact = ArtifactStore.create({
      ...data,
      artifactType: data.artifactType ?? data.type,
    });
    // Normalise: wrap in { artifact } with consistent shape for tests
    const normalised = { ...artifact };
    if (!normalised.artifactId && normalised.id) normalised.artifactId = normalised.id;
    res.status(201).json({ artifact: normalised });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/artifacts/:id — get single artifact
app.get('/api/artifacts/:id', (req, res) => {
  const art = ArtifactStore.getById(req.params.id);
  if (!art) return res.status(404).json({ error: 'Artifact not found' });
  res.json(art);
});

// GET /api/artifacts/:id/summary — lightweight preview-safe summary
app.get('/api/artifacts/:id/summary', (req, res) => {
  try {
    res.json(ArtifactStore.getSummary(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/artifacts/:id/versions — full version history for a group
app.get('/api/artifacts/:id/versions', (req, res) => {
  try {
    const art = ArtifactStore.getById(req.params.id);
    if (!art) return res.status(404).json({ error: 'Artifact not found' });
    res.json(ArtifactStore.getVersionHistory(art.groupId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/artifacts/:id/staleness — staleness check
app.get('/api/artifacts/:id/staleness', (req, res) => {
  try {
    res.json(ArtifactStore.getStaleness(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/artifacts/:id/mark-sent — mark artifact as sent
app.post('/api/artifacts/:id/mark-sent', (req, res) => {
  try {
    const art = ArtifactStore.markSent(req.params.id, { sentBy: req.body?.sent_by ?? 'user' });
    res.json(art);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/cache — invalidate by prefix
app.delete('/api/cache', validate(z.object({ prefix: z.string().min(1).max(100) })), (req, res) => {
  CacheService.invalidate(req.validated.prefix);
  res.json({ invalidated: true, prefix: req.validated.prefix });
});

// ─── Timing routes ────────────────────────────────────────────────────────────

// GET /api/timing/summary — full timing summary across all entity sets
app.post('/api/timing/summary', (req, res) => {
  try {
    const entitySets = req.body ?? {};
    const summary = TimingEngine.generateTimingSummary(entitySets);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timing/alerts — flat SLA alert list, sorted by severity
app.post('/api/timing/alerts', (req, res) => {
  try {
    const entitySets = req.body ?? {};
    const alerts = TimingEngine.generateSlaAlerts(entitySets);
    res.json({ total: alerts.length, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timing/thresholds — expose all configurable thresholds (read-only)
app.get('/api/timing/thresholds', (_req, res) => {
  res.json(ALL_THRESHOLDS);
});

// GET /api/timing/entity/:entityType/:id — calculate timing state for one entity
app.post('/api/timing/entity/:entityType/:id', (req, res) => {
  const { entityType } = req.params;
  const entity = { id: req.params.id, ...(req.body ?? {}) };

  try {
    let result;
    switch (entityType) {
      case 'task':            result = TimingEngine.calcTaskSlaState(entity);       break;
      case 'deal':            result = TimingEngine.calcDealVelocityState(entity);  break;
      case 'deal_heat':       result = TimingEngine.calcDealHeat(entity);           break;
      case 'relationship':    result = TimingEngine.calcRelationshipState(entity);  break;
      case 'board_candidate': result = TimingEngine.calcBoardCandidateState(entity);break;
      case 'board_seat':      result = TimingEngine.calcBoardSeatTiming(entity);    break;
      case 'diligence_issue': result = TimingEngine.calcDiligenceIssueSla(entity);  break;
      case 'meeting':         result = TimingEngine.calcMeetingState(entity);       break;
      case 'investor':        result = TimingEngine.calcInvestorState(entity);      break;
      case 'approval':        result = TimingEngine.calcApprovalState(entity);      break;
      case 'artifact':        result = TimingEngine.calcArtifactStaleness(entity);  break;
      default:
        return res.status(400).json({ error: `Unknown entity type: ${entityType}` });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Recovery routes ──────────────────────────────────────────────────────────

// POST /api/recovery/generate — generate recovery actions from SLA alerts
app.post('/api/recovery/generate', (req, res) => {
  try {
    const { entity_sets = {}, entity_maps = {} } = req.body ?? {};
    const slaAlerts       = TimingEngine.generateSlaAlerts(entity_sets);
    const recoveryActions = RecoveryEngine.generateRecoveryActions(slaAlerts, entity_maps);
    res.json({
      sla_alert_count:      slaAlerts.length,
      recovery_action_count: recoveryActions.length,
      critical_count:       recoveryActions.filter(a => a.severity === 'critical_intervention').length,
      urgent_count:         recoveryActions.filter(a => a.severity === 'urgent_recovery').length,
      actions:              recoveryActions,
      generated_at:         new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recovery/apply-task-pack — convert recovery actions into task-pack format
app.post('/api/recovery/apply-task-pack', validate(z.object({
  recovery_action: z.object({
    recovery_id:   z.string(),
    action_type:   z.string(),
    severity:      z.string(),
    title:         z.string(),
    reason:        z.string(),
    entity_type:   z.string(),
    entity_id:     z.string().nullable().optional(),
    due_at:        z.string().optional(),
    priority:      z.string().optional(),
  }),
})), (req, res) => {
  try {
    const pack = RecoveryEngine.buildRecoveryTaskPack(req.validated.recovery_action);
    res.status(201).json(pack);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Integration routes ───────────────────────────────────────────────────────

// GET /api/integrations — all integration config (sanitized) + status
app.get('/api/integrations', (_req, res) => {
  res.json({
    config: IntegrationRegistry.getAllConfig(),
    status: IntegrationRegistry.getAllStatus(),
  });
});

// GET /api/integrations/:name — single integration
app.get('/api/integrations/:name', (req, res) => {
  const { name } = req.params;
  const config = IntegrationRegistry.getConfig(name);
  if (!config) return errorResponse(res, 404, 'NOT_FOUND', `Unknown integration: ${name}`);
  const status = IntegrationRegistry.getStatus(name);
  const safeConfig = { ...config, apiKey: config.apiKey ? '***' : null, credentials: config.credentials ? '***' : null };
  res.json({ name, config: safeConfig, status });
});

// PATCH /api/integrations/:name — update integration settings
app.patch('/api/integrations/:name', validate(IntegrationPatchSchema), (req, res) => {
  const { name } = req.params;
  const config = IntegrationRegistry.getConfig(name);
  if (!config) return errorResponse(res, 404, 'NOT_FOUND', `Unknown integration: ${name}`);

  // Merge into store.settings so IntegrationRegistry.syncFromSettings() picks it up
  const patch = req.validated;
  if (patch.enabled !== undefined) {
    if (name === 'apollo')   store.settings.apolloEnabled   = patch.enabled;
    if (name === 'calendar') store.settings.calendarEnabled = patch.enabled;
    if (name === 'ai')       store.settings.aiDraftingEnabled = patch.enabled;
    if (name === 'email')    { /* email on/off managed via smtp settings */ }
  }
  if (patch.apolloApiKey)     store.settings.apolloApiKey      = patch.apolloApiKey;
  if (patch.calendarProvider) store.settings.calendarProvider  = patch.calendarProvider;

  IntegrationRegistry.syncFromSettings(store.settings);
  AuditLogService.log(AuditLogService.AUDIT_EVENTS.SETTINGS_UPDATED, 'integration', name, { patch: Object.keys(patch) });

  res.json({
    name,
    status: IntegrationRegistry.getStatus(name),
    message: `Integration "${name}" updated.`,
  });
});

// POST /api/integrations/:name/test — run health check for single integration
app.post('/api/integrations/:name/test', async (req, res) => {
  const { name } = req.params;
  const checkers = {
    apollo:   IntegrationHealthService.checkApolloConnection,
    ai:       IntegrationHealthService.checkAIConnection,
    calendar: IntegrationHealthService.checkCalendarConnection,
    email:    IntegrationHealthService.checkEmailConnection,
  };
  const checker = checkers[name];
  if (!checker) return errorResponse(res, 404, 'NOT_FOUND', `Unknown integration: ${name}`);

  try {
    const result = await checker();
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Health check failed: ${err.message}`);
  }
});

// POST /api/integrations/health/check-all — run all health checks
app.post('/api/integrations/health/check-all', async (req, res) => {
  try {
    const results = await IntegrationHealthService.checkAll();
    res.json({ results, checkedAt: new Date().toISOString() });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Health checks failed');
  }
});

// ─── Velocity Intelligence ────────────────────────────────────────────────────

// GET /api/velocity — full pipeline velocity metrics + stall analysis
app.get('/api/velocity', asyncRoute(async (req, res) => {
  const userId = await repo.getSystemUserId();
  const metrics = await VelocityService.computeVelocityMetrics(userId, store.deals);
  res.json(metrics);
}));

// GET /api/velocity/trend — week-over-week activity trend
app.get('/api/velocity/trend', asyncRoute(async (req, res) => {
  const userId = await repo.getSystemUserId();
  const trend = await VelocityService.getWeeklyVelocityTrend(userId);
  res.json(trend ?? { message: 'Trend data requires database connection' });
}));

// ─── Performance Systems (Systems 1-8) ───────────────────────────────────────

// GET /api/pipeline-pressure — System 1 dashboard metrics
app.get('/api/pipeline-pressure', (_req, res) => {
  try {
    PipelinePressureService.updatePressureLevels(store);
    const metrics = PipelinePressureService.getDashboardMetrics(store);
    res.json(metrics);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute pipeline pressure');
  }
});

// GET /api/scoreboard — System 5 acquisition scoreboard
app.get('/api/scoreboard', (_req, res) => {
  try {
    res.json(PipelinePressureService.computeScoreboard(store));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute scoreboard');
  }
});

// GET /api/deal-velocity — System 7 deal velocity tracker
app.get('/api/deal-velocity', (_req, res) => {
  try {
    const velocity = PipelinePressureService.checkDealVelocity(store.deals);
    const slowMoving = velocity.filter((v) => v.slowMoving);
    res.json({ deals: velocity, slowMovingCount: slowMoving.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute deal velocity');
  }
});

// GET /api/conversation-funnel — System 8 conversation funnel
app.get('/api/conversation-funnel', (_req, res) => {
  try {
    res.json(PipelinePressureService.computeConversationFunnel(store));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute conversation funnel');
  }
});

// GET /api/frequency-progress — System 6 contact frequency targets
app.get('/api/frequency-progress', (_req, res) => {
  try {
    res.json(PipelinePressureService.computeFrequencyProgress(store));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute frequency progress');
  }
});

// POST /api/pipeline-pressure/scan — manually trigger pipeline scan + task creation
app.post('/api/pipeline-pressure/scan', (_req, res) => {
  try {
    PipelinePressureService.updatePressureLevels(store);
    const stalled  = PipelinePressureService.scanForStalledEntities(store);
    const created  = PipelinePressureService.createFollowUpTasks(stalled, store, uid, nowIso);
    const metrics  = PipelinePressureService.getDashboardMetrics(store);
    AuditLogService.log(AuditLogService.AUDIT_EVENTS.AGENT_RUN, 'system', 'pipeline_pressure_scan', { tasksCreated: created.length });
    res.json({ ...metrics, tasksCreated: created.length, tasks: created });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Pipeline scan failed');
  }
});

// ─── Sourcing Radar routes ────────────────────────────────────────────────────

// GET /api/sourcing-radar/adapters — list all source adapters
app.get('/api/sourcing-radar/adapters', (_req, res) => {
  try {
    res.json({ adapters: SourceAdapterRegistryService.getAllAdapters() });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to list adapters');
  }
});

// PATCH /api/sourcing-radar/adapters/:id — update adapter config/enabled
app.patch('/api/sourcing-radar/adapters/:id', validate(z.object({
  isEnabled:   z.boolean().optional(),
  adapterName: z.string().max(200).trim().optional(),
  config:      z.record(z.any()).optional(),
}).strict()), (req, res) => {
  try {
    const updated = SourceAdapterRegistryService.updateAdapter(req.params.id, req.validated);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Adapter not found');
    res.json({ adapter: { ...updated, config: { ...updated.config, apiKey: updated.config?.apiKey ? '***' : undefined } } });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/sourcing-radar/adapters/:id/health-check — run health check
app.post('/api/sourcing-radar/adapters/:id/health-check', async (req, res) => {
  try {
    const result = await SourceAdapterRegistryService.runHealthCheck(req.params.id);
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/sourcing-radar/run — manually trigger a scan
app.post('/api/sourcing-radar/run', async (req, res) => {
  try {
    const runRecord = await SourcingRadarService.runScheduledScan({
      manual: true,
      triggeredBy: 'manual',
      settings: store.settings,
    });
    res.json({ run: runRecord });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Scan failed: ${err.message}`);
  }
});

// GET /api/sourcing-radar/runs — scan history
app.get('/api/sourcing-radar/runs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  res.json({ runs: SourcingRadarService.getRunHistory(limit) });
});

// GET /api/sourcing-radar/candidates — review queue
app.get('/api/sourcing-radar/candidates', (req, res) => {
  const { reviewStatus, minScore, industry, state } = req.query;
  const list = SourcingRadarService.getReviewQueue({
    reviewStatus,
    minScore: minScore ? Number(minScore) : undefined,
    industry,
    state,
  });
  res.json({ candidates: list, total: list.length });
});

// PATCH /api/sourcing-radar/candidates/:id — update review status
app.patch('/api/sourcing-radar/candidates/:id', validate(z.object({
  reviewStatus:        z.enum(['pending_review', 'accepted_to_crm', 'rejected', 'archived']).optional(),
  qualificationStatus: z.enum(['unreviewed', 'qualified', 'disqualified', 'needs_manual_review']).optional(),
  notes:               z.string().max(5000).optional(),
}).strict()), (req, res) => {
  try {
    const candidate = SourcingRadarService.updateCandidateReview(req.params.id, req.validated);
    if (!candidate) return errorResponse(res, 404, 'NOT_FOUND', 'Candidate not found');
    res.json({ candidate });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/sourcing-radar/candidates/:id/accept — accept to CRM
app.post('/api/sourcing-radar/candidates/:id/accept', (req, res) => {
  try {
    const result = SourcingRadarService.acceptCandidateToCRM(req.params.id, uid, nowIso);
    if (!result) return errorResponse(res, 404, 'NOT_FOUND', 'Candidate not found');
    AuditLogService.log(AuditLogService.AUDIT_EVENTS.COMPANY_CREATED, 'sourcing_radar', result.candidate.id, { companyId: result.company.id });
    res.json({ company: result.company, candidate: result.candidate });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/sourcing-radar/import-csv — manual CSV import
app.post('/api/sourcing-radar/import-csv', validate(z.object({
  rows: z.array(z.record(z.string())).min(1).max(500),
}).strict()), async (req, res) => {
  try {
    const { rows } = req.validated;
    // Find or use the manual import adapter
    const adapters = SourceAdapterRegistryService.getEnabledAdapters();
    const manualEntry = adapters.find((e) => e.meta.adapterType === 'manual_import');
    if (!manualEntry) return errorResponse(res, 400, 'ADAPTER_DISABLED', 'Manual import adapter not enabled');

    const { candidates } = await manualEntry.instance.fetchCandidates({ filters: { rows } });

    let inserted = 0;
    let duplicates = 0;
    for (const c of candidates) {
      const { dedupeStatus, linkedCompanyId, normalizedHash } =
        CandidateDeduplicationService.determineDedupeStatus(
          c, store.companies, store.sourcingRadarCandidates
        );
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
});

// ─── Meeting Prep routes ───────────────────────────────────────────────────────

// GET /api/meetings/:id/prep — get prep packet for meeting
app.get('/api/meetings/:id/prep', (req, res) => {
  try {
    const packet = MeetingPreparationService.getPrepPacket(req.params.id);
    res.json({ packet: packet || null });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to get prep packet');
  }
});

// POST /api/meetings/:id/prep — generate (or regenerate) prep packet
app.post('/api/meetings/:id/prep', async (req, res) => {
  try {
    const meeting = findById(store.meetings, req.params.id);
    if (!meeting) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');

    const aiEnabled = store.settings?.enableMeetingPrepAI !== false;
    const packet = await MeetingPreparationService.buildPrepPacket(req.params.id, aiEnabled);
    if (!packet) return errorResponse(res, 500, 'INTERNAL_ERROR', 'Prep packet generation failed');
    res.json({ packet });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Prep generation failed: ${err.message}`);
  }
});

// PATCH /api/meetings/:id/prep — manually edit prep packet
app.patch('/api/meetings/:id/prep', validate(z.object({
  agenda:               z.array(z.string()).optional(),
  keyQuestions:         z.array(z.string()).optional(),
  motivationHypotheses: z.array(z.string()).optional(),
  riskFlags:            z.array(z.string()).optional(),
  meetingObjectives:    z.array(z.string()).optional(),
  recommendedNextStepTargets: z.array(z.string()).optional(),
  status: z.enum(['draft', 'final', 'archived']).optional(),
}).strict()), (req, res) => {
  try {
    const packet = MeetingPreparationService.getPrepPacket(req.params.id);
    if (!packet) return errorResponse(res, 404, 'NOT_FOUND', 'No prep packet for this meeting');
    const updated = MeetingPreparationService.updatePrepPacket(packet.id, req.validated);
    res.json({ packet: updated });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/meeting-prep/packets — list all prep packets
app.get('/api/meeting-prep/packets', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const packets = (store.meetingPrepPackets || []).slice(0, limit);
  res.json({ packets, total: packets.length });
});

// ─── Deal Probability routes ──────────────────────────────────────────────────

// GET /api/deals/:id/probability — get current probability score
app.get('/api/deals/:id/probability', (req, res) => {
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

// POST /api/deals/:id/probability/refresh — recompute probability score
app.post('/api/deals/:id/probability/refresh', (req, res) => {
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

// POST /api/deals/probability/refresh-all — recompute all active deals
app.post('/api/deals/probability/refresh-all', (req, res) => {
  try {
    const count = DealProbabilityService.refreshAllActiveDealProbabilities(store);
    res.json({ refreshed: count });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Bulk probability refresh failed');
  }
});

// POST /api/agents/conversation-prep
app.post('/api/agents/conversation-prep', validate(z.object({
  meetingId: z.string().uuid(),
  model: z.string().max(100).optional(),
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

// POST /api/agents/deal-probability-commentary
app.post('/api/agents/deal-probability-commentary', validate(z.object({
  dealId: z.string().uuid(),
  model: z.string().max(100).optional(),
})), async (req, res) => {
  try {
    const deal = findById(store.deals, req.validated.dealId);
    if (!deal) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
    const company = deal.companyId ? findById(store.companies, deal.companyId) : null;
    const interactions = (store.interactions || []).filter((i) => i.companyId === deal.companyId || i.dealId === deal.id);
    const scenarios = (store.underwritingScenarios || []).filter((s) => s.dealId === deal.id);
    // Ensure score is fresh
    DealProbabilityService.refreshDealProbability(deal, store);
    const result = await AgentOrchestrator.run('DealProbabilityCommentaryAgent', {
      deal, interactions, scenarios, company, costFlags: store.settings,
    });
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'AI_UNAVAILABLE', err.message);
  }
});

// GET /api/dashboard/probability-summary — high/low probability deal summary
app.get('/api/dashboard/probability-summary', (req, res) => {
  try {
    const activeDeals = (store.deals || []).filter((d) => d.status === 'active');
    const highThreshold = store.settings?.probabilityHighThreshold || 60;
    const lowThreshold  = store.settings?.probabilityLowRescueThreshold || 30;

    const highProbability = activeDeals
      .filter((d) => (d.probabilityScore ?? 0) >= highThreshold)
      .sort((a, b) => (b.probabilityScore || 0) - (a.probabilityScore || 0))
      .slice(0, 5)
      .map((d) => ({ id: d.id, companyName: d.companyName, probabilityScore: d.probabilityScore, probabilityBand: d.probabilityBand, stage: d.stage }));

    const lowProbability = activeDeals
      .filter((d) => d.probabilityScore !== undefined && d.probabilityScore < lowThreshold)
      .sort((a, b) => (a.probabilityScore || 0) - (b.probabilityScore || 0))
      .slice(0, 5)
      .map((d) => ({
        id: d.id, companyName: d.companyName, probabilityScore: d.probabilityScore,
        probabilityBand: d.probabilityBand, stage: d.stage,
        mainBlocker: (d.probabilityNotes || 'Review deal details'),
      }));

    res.json({ highProbability, lowProbability, highThreshold, lowThreshold });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute probability summary');
  }
});

// GET /api/dashboard/sourcing-summary — sourcing radar summary for command center
app.get('/api/dashboard/sourcing-summary', (req, res) => {
  try {
    const now = Date.now();
    const todayStart = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const allCandidates  = store.sourcingRadarCandidates || [];
    const newToday       = allCandidates.filter((c) => c.createdAt >= todayStart).length;
    const highPriority   = allCandidates.filter((c) => c.reviewStatus === 'pending_review' && c.relevanceScore >= (store.settings?.sourcingMinRelevanceThreshold || 50)).length;
    const sourceWarnings = (store.sourceAdapters || []).filter((a) => a.isEnabled && ['unreachable', 'misconfigured', 'rate_limited'].includes(a.status)).length;
    const lastRun = SourcingRadarService.getLastRun();

    res.json({ newCandidatesToday: newToday, highPriorityCount: highPriority, sourceWarnings, lastRunAt: lastRun?.completedAt || null, lastRunStatus: lastRun?.status || null });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute sourcing summary');
  }
});

// GET /api/dashboard/prep-summary — meeting prep status for command center
app.get('/api/dashboard/prep-summary', (req, res) => {
  try {
    const upcomingWindow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const upcomingMeetings = (store.meetings || []).filter((m) => {
      if (!['confirmed', 'scheduled', 'proposed'].includes(m.status)) return false;
      const start = new Date(m.startsAt);
      return start > now && start <= upcomingWindow;
    });

    const prepPacketIds = new Set((store.meetingPrepPackets || []).map((p) => p.meetingId));
    const missingPrep   = upcomingMeetings.filter((m) => !prepPacketIds.has(m.id));

    const highValueTypes = ['seller_discovery', 'seller_followup', 'diligence_review'];
    const highValueMissingPrep = missingPrep.filter((m) => highValueTypes.includes(m.meetingType));

    res.json({
      upcomingCount:      upcomingMeetings.length,
      missingPrepCount:   missingPrep.length,
      highValueMissing:   highValueMissingPrep.length,
      meetings:           upcomingMeetings.slice(0, 5).map((m) => ({
        id: m.id, title: m.title, meetingType: m.meetingType, startsAt: m.startsAt,
        hasPrepPacket: prepPacketIds.has(m.id),
      })),
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute prep summary');
  }
});

// ─── Capital Raising: Investor CRM ───────────────────────────────────────────

app.get('/api/capital-raising/investors', (req, res) => {
  try {
    const { investorType, relationshipStage, minCheckSize, industry } = req.query;
    const list = InvestorCRMService.listInvestors({
      investorType,
      relationshipStage,
      minCheckSize: minCheckSize ? Number(minCheckSize) : undefined,
      industry,
    });
    res.json({ investors: list, total: list.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/capital-raising/investors', validate(InvestorSchema), (req, res) => {
  try {
    const investor = InvestorCRMService.createInvestor(req.validated);
    AuditLogService.log('investor_created', { investorId: investor.id, name: investor.name });
    AutomationRuleEngine.fire('investor_created', { investor }, serviceCtx);
    res.status(201).json(investor);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/capital-raising/investors/:id', (req, res) => {
  const investor = InvestorCRMService.getInvestor(req.params.id);
  if (!investor) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
  res.json(investor);
});

app.patch('/api/capital-raising/investors/:id', (req, res) => {
  try {
    const updated = InvestorCRMService.updateInvestor(req.params.id, req.body);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    if (updated.relationshipStage === 'engaged') {
      AutomationRuleEngine.fire('investor_engaged', { investor: updated }, serviceCtx);
    }
    res.json(updated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.delete('/api/capital-raising/investors/:id', (req, res) => {
  const deleted = InvestorCRMService.deleteInvestor(req.params.id);
  if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
  AuditLogService.log('investor_deleted', { investorId: req.params.id });
  res.json({ success: true });
});

app.post('/api/capital-raising/investors/:id/mark-interested', (req, res) => {
  try {
    const updated = InvestorCRMService.markInterested(req.params.id);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Investor not found');
    res.json(updated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Capital Raising: Capital Stack ──────────────────────────────────────────

app.get('/api/capital-raising/capital-stacks', (req, res) => {
  const list = CapitalStackService.listStacks(req.query.dealId || null);
  res.json({ capitalStacks: list });
});

app.post('/api/capital-raising/capital-stacks', validate(CapitalStackSchema), (req, res) => {
  try {
    const stack = CapitalStackService.createStack(req.validated.dealId, req.validated);
    res.status(201).json(stack);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/capital-raising/capital-stacks/:id', (req, res) => {
  const stack = CapitalStackService.getStack(req.params.id);
  if (!stack) return errorResponse(res, 404, 'NOT_FOUND', 'Capital stack not found');
  res.json(stack);
});

app.patch('/api/capital-raising/capital-stacks/:id', (req, res) => {
  try {
    const updated = CapitalStackService.updateStack(req.params.id, req.body);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Capital stack not found');
    res.json(updated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.delete('/api/capital-raising/capital-stacks/:id', (req, res) => {
  const deleted = CapitalStackService.deleteStack(req.params.id);
  if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Capital stack not found');
  res.json({ success: true });
});

// ─── Capital Raising: Investor Memos ─────────────────────────────────────────

app.get('/api/capital-raising/memos', (req, res) => {
  const list = InvestorMemoService.listMemos(req.query.dealId || null);
  res.json({ memos: list });
});

app.post('/api/capital-raising/memos', validate(InvestorMemoSchema), (req, res) => {
  try {
    const memo = InvestorMemoService.createMemo(req.validated);
    res.status(201).json(memo);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/capital-raising/memos/:id', (req, res) => {
  const memo = InvestorMemoService.getMemo(req.params.id);
  if (!memo) return errorResponse(res, 404, 'NOT_FOUND', 'Memo not found');
  res.json(memo);
});

app.patch('/api/capital-raising/memos/:id', (req, res) => {
  try {
    const updated = InvestorMemoService.updateMemo(req.params.id, req.body);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Memo not found');
    res.json(updated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.delete('/api/capital-raising/memos/:id', (req, res) => {
  const deleted = InvestorMemoService.deleteMemo(req.params.id);
  if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Memo not found');
  res.json({ success: true });
});

app.post('/api/capital-raising/memos/generate', async (req, res) => {
  try {
    const { useAI = true, ...data } = req.body;
    const generated = await InvestorMemoService.generateMemo(data, useAI);
    res.json(generated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Capital Raising: Firm Messaging ─────────────────────────────────────────

app.get('/api/capital-raising/messaging', (req, res) => {
  const list = FirmMessagingService.list();
  res.json({ firmMessaging: list, latest: list[0] || null });
});

app.post('/api/capital-raising/messaging', validate(FirmMessagingSchema), (req, res) => {
  try {
    const record = FirmMessagingService.create(req.validated);
    res.status(201).json(record);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.patch('/api/capital-raising/messaging/:id', (req, res) => {
  try {
    const updated = FirmMessagingService.update(req.params.id, req.body);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Firm messaging record not found');
    res.json(updated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/capital-raising/messaging/generate', async (req, res) => {
  try {
    const { useAI = true, ...inputs } = req.body;
    const result = await FirmMessagingService.generateMission(inputs, useAI);
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Capital Raising: Pitch Deck ──────────────────────────────────────────────

app.get('/api/capital-raising/pitch-decks', (req, res) => {
  res.json({ pitchDecks: PitchDeckService.listDecks() });
});

app.get('/api/capital-raising/pitch-decks/:id', (req, res) => {
  const deck = PitchDeckService.getDeck(req.params.id);
  if (!deck) return errorResponse(res, 404, 'NOT_FOUND', 'Pitch deck not found');
  res.json(deck);
});

app.post('/api/capital-raising/pitch-decks', (req, res) => {
  try {
    const deck = PitchDeckService.saveDeck(req.body);
    res.status(201).json(deck);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.patch('/api/capital-raising/pitch-decks/:id', (req, res) => {
  try {
    const deck = PitchDeckService.getDeck(req.params.id);
    if (!deck) return errorResponse(res, 404, 'NOT_FOUND', 'Pitch deck not found');
    const updated = PitchDeckService.saveDeck({ ...req.body, id: req.params.id });
    res.json(updated);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.delete('/api/capital-raising/pitch-decks/:id', (req, res) => {
  const deleted = PitchDeckService.deleteDeck(req.params.id);
  if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Pitch deck not found');
  res.json({ success: true });
});

app.post('/api/capital-raising/pitch-decks/generate', async (req, res) => {
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
});

// ─── Capital Raising: Outreach ────────────────────────────────────────────────

app.post('/api/capital-raising/outreach/generate', async (req, res) => {
  try {
    const { mode = 'introduction', investorId, dealSummary, useAI = true } = req.body;
    const investor = investorId ? InvestorCRMService.getInvestor(investorId) : req.body.investor;
    const firmMessaging = FirmMessagingService.getLatest();
    const result = await InvestorOutreachAgent.run(
      { mode, investor, dealSummary, firmMessaging },
      useAI ? AIService : null
    );
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Capital Raising: Dashboard ───────────────────────────────────────────────

app.get('/api/capital-raising/dashboard', (req, res) => {
  try {
    const pipeline = InvestorCRMService.getPipelineSummary();
    const capital  = CapitalStackService.getCapitalSummary();
    res.json({ pipeline, capital });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Execution Tracker ───────────────────────────────────────────────────────

// GET /api/execution/summary — full execution snapshot (dashboard widget)
app.get('/api/execution/summary', (req, res) => {
  try {
    res.json(ExecutionTrackerService.getExecutionSummary());
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/pipeline-health
app.get('/api/execution/pipeline-health', (req, res) => {
  try {
    res.json(ExecutionTrackerService.getPipelineHealth());
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/targets
app.get('/api/execution/targets', (req, res) => {
  try {
    res.json({ targets: ExecutionTrackerService.getTargets() });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// PATCH /api/execution/targets — update a single target
app.patch('/api/execution/targets', (req, res) => {
  try {
    const { targetType, targetValue, period } = req.body;
    if (!targetType || targetValue === undefined) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'targetType and targetValue required');
    }
    const targets = ExecutionTrackerService.setTarget(targetType, Number(targetValue), period);
    res.json({ targets });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/target-completion
app.get('/api/execution/target-completion', (req, res) => {
  try {
    res.json(ExecutionTrackerService.checkTargetCompletion());
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/daily — today's stats (computed + manual)
app.get('/api/execution/daily', (req, res) => {
  try {
    const date = req.query.date || undefined;
    const stat = date
      ? ExecutionTrackerService.getDailyStats(date)
      : ExecutionTrackerService.getTodayStats();
    const targets = ExecutionTrackerService.getTargets();
    res.json({ stat, targets });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/daily/history
app.get('/api/execution/daily/history', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 90);
    res.json({ stats: ExecutionTrackerService.getDailyStatsList(limit) });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/execution/daily — manual daily activity entry
app.post('/api/execution/daily', (req, res) => {
  try {
    const stat = ExecutionTrackerService.recordDailyActivity(req.body);
    res.json(stat);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/weekly
app.get('/api/execution/weekly', (req, res) => {
  try {
    const weekStart = req.query.weekStart || undefined;
    const stat    = ExecutionTrackerService.getWeeklyStats(weekStart);
    const targets = ExecutionTrackerService.getTargets();
    res.json({ stat, targets });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/execution/weekly — manual override
app.post('/api/execution/weekly', (req, res) => {
  try {
    const { weekStart, ...patch } = req.body;
    const stat = ExecutionTrackerService.updateWeeklyStats(patch, weekStart);
    res.json(stat);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/monthly
app.get('/api/execution/monthly', (req, res) => {
  try {
    const month   = req.query.month || undefined;
    const stat    = ExecutionTrackerService.getMonthlyStats(month);
    const targets = ExecutionTrackerService.getTargets();
    res.json({ stat, targets });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/execution/monthly — manual override
app.post('/api/execution/monthly', (req, res) => {
  try {
    const { month, ...patch } = req.body;
    const stat = ExecutionTrackerService.updateMonthlyStats(patch, month);
    res.json(stat);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/pipeline
app.get('/api/execution/pipeline', (req, res) => {
  try {
    const pipeline = ExecutionTrackerService.calculatePipelineStats();
    const targets  = ExecutionTrackerService.getTargets();
    res.json({ pipeline, targets });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/board
app.get('/api/execution/board', (req, res) => {
  try {
    const board   = ExecutionTrackerService.calculateBoardStats();
    const targets = ExecutionTrackerService.getTargets();
    res.json({ board, targets });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/investors
app.get('/api/execution/investors', (req, res) => {
  try {
    const investors = ExecutionTrackerService.calculateInvestorStats();
    const targets   = ExecutionTrackerService.getTargets();
    res.json({ investors, targets });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/deal-momentum
app.get('/api/execution/deal-momentum', (req, res) => {
  try {
    const momentum = ExecutionTrackerService.calculateMomentumStats();
    res.json({
      momentum,
      stalled: momentum.filter((m) => m.riskLevel === 'stalled'),
      cooling: momentum.filter((m) => m.riskLevel === 'cooling'),
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/execution/alerts
app.get('/api/execution/alerts', (req, res) => {
  try {
    const summary = ExecutionTrackerService.getExecutionSummary();
    res.json({ alerts: summary.alerts });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Playbook Engine Routes ───────────────────────────────────────────────────

// GET /api/playbook/summary — dashboard widget data
app.get('/api/playbook/summary', (req, res) => {
  try {
    res.json(PlaybookService.getPlaybookSummary());
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/playbook/stages — all 17 stages with completion status
app.get('/api/playbook/stages', (req, res) => {
  try {
    const stages = PlaybookService.getStages().map((stage) => ({
      ...stage,
      completion: PlaybookService.evaluateStageCompletion(stage.id),
    }));
    res.json({ stages });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/playbook/current — current active stage with tasks
app.get('/api/playbook/current', (req, res) => {
  try {
    res.json(PlaybookService.getCurrentStage());
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/playbook/stages/:id — single stage with tasks + progress
app.get('/api/playbook/stages/:id', (req, res) => {
  try {
    const stage = PlaybookService.getStage(req.params.id);
    if (!stage) return errorResponse(res, 404, 'NOT_FOUND', 'Playbook stage not found');
    const tasks      = PlaybookService.getTasksForStage(stage.id);
    const progress   = PlaybookService.getProgressForStage(stage.id);
    const completion = PlaybookService.evaluateStageCompletion(stage.id);
    res.json({ stage, tasks, progress, completion });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/playbook/next-tasks — next N incomplete tasks
app.get('/api/playbook/next-tasks', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    res.json({ tasks: PlaybookService.getNextTasks(limit) });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/playbook/tasks/:id/complete — mark task complete
app.post('/api/playbook/tasks/:id/complete', (req, res) => {
  try {
    const task = (store.playbookTasks || []).find((t) => t.id === req.params.id);
    if (!task) return errorResponse(res, 404, 'NOT_FOUND', 'Playbook task not found');
    const { notes = '' } = req.body;
    const progress = PlaybookService.markTaskComplete(req.params.id, notes);
    AuditLogService.log('playbook_task_completed', { taskId: req.params.id, title: task.taskTitle });
    res.json({ progress, task });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// PATCH /api/playbook/tasks/:id/status — update task status
app.patch('/api/playbook/tasks/:id/status', (req, res) => {
  try {
    const { status, notes = '' } = req.body;
    if (!status) return errorResponse(res, 400, 'VALIDATION_ERROR', 'status required');
    const task = (store.playbookTasks || []).find((t) => t.id === req.params.id);
    if (!task) return errorResponse(res, 404, 'NOT_FOUND', 'Playbook task not found');
    const progress = PlaybookService.updateTaskStatus(req.params.id, status, notes);
    AuditLogService.log('playbook_task_updated', { taskId: req.params.id, status });
    res.json({ progress, task });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/playbook/today — daily action plan
app.get('/api/playbook/today', (req, res) => {
  try {
    let executionSummary = null;
    try { executionSummary = ExecutionTrackerService.getExecutionSummary(); } catch { /* optional */ }
    const daily = PlaybookService.generateDailyActions(executionSummary);
    res.json(daily);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// POST /api/playbook/sync — re-evaluate automatic task completions
app.post('/api/playbook/sync', (req, res) => {
  try {
    const synced = PlaybookService.syncAutomaticTasks();
    AuditLogService.log('playbook_synced', { synced });
    res.json({ synced, message: `${synced} automatic task${synced !== 1 ? 's' : ''} updated` });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// GET /api/playbook/progress — all progress records
app.get('/api/playbook/progress', (req, res) => {
  try {
    res.json({ progress: store.playbookProgress || [] });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Deal Feed Automation Rules ───────────────────────────────────────────────
AutomationRuleEngine.register({
  id: 'deal_feed_import_playbook_sync',
  description: 'When a listing is imported to CRM → sync playbook automatic tasks',
  trigger: 'company_created',
  condition: (ctx) => !!(ctx.company?.sourceDealFeedId),
  action: () => {
    PlaybookService.syncAutomaticTasks();
    return { synced: true };
  },
  enabled: true,
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEAL FEED MARKETPLACE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Zod schemas ───────────────────────────────────────────────────────────────


// ─── GET /api/deal-feed — list with filters + pagination ──────────────────────
app.get('/api/deal-feed', (req, res) => {
  try {
    const {
      industry, location, minRevenue, maxRevenue,
      minYears, maxYears, minScore, status, search,
      sortBy, sortDir, page, pageSize,
    } = req.query;

    const result = DealFeedService.listListings({
      industry:   industry   ? String(industry).slice(0, 100)   : undefined,
      location:   location   ? String(location).slice(0, 200)   : undefined,
      minRevenue: minRevenue ? Number(minRevenue)  : undefined,
      maxRevenue: maxRevenue ? Number(maxRevenue)  : undefined,
      minYears:   minYears   ? Number(minYears)    : undefined,
      maxYears:   maxYears   ? Number(maxYears)    : undefined,
      minScore:   minScore   ? Number(minScore)    : undefined,
      status:     status     ? String(status)      : 'active',
      search:     search     ? String(search).slice(0, 200) : undefined,
      sortBy:     sortBy     ? String(sortBy)      : 'acquisitionScore',
      sortDir:    sortDir    ? String(sortDir)      : 'desc',
      page:       page       ? parseInt(page, 10)  : 1,
      pageSize:   pageSize   ? parseInt(pageSize, 10) : 20,
    });
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/deal-feed/summary ────────────────────────────────────────────────
app.get('/api/deal-feed/summary', (req, res) => {
  try {
    res.json(DealFeedService.getSummary());
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/deal-feed/saved — saved listings for user ───────────────────────
app.get('/api/deal-feed/saved', (req, res) => {
  try {
    const userId = req.query.userId ? String(req.query.userId).slice(0, 100) : 'default';
    res.json({ saved: DealFeedService.getSavedListings(userId) });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/deal-feed/:id — single listing (full contact details) ───────────
app.get('/api/deal-feed/:id', (req, res) => {
  try {
    const listing = DealFeedService.getListing(req.params.id);
    if (!listing) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
    // Score breakdown for detail view
    const scoreBreakdown = DealFeedScoringService.breakdown(listing);
    res.json({ listing, scoreBreakdown });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── POST /api/deal-feed — create listing manually ────────────────────────────
app.post('/api/deal-feed', validate(DealFeedListingSchema), (req, res) => {
  try {
    const listing = DealFeedService.createListing(req.validated);
    res.status(201).json({ listing });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── PATCH /api/deal-feed/:id — update listing ────────────────────────────────
app.patch('/api/deal-feed/:id', validate(DealFeedListingPatchSchema), (req, res) => {
  try {
    const updated = DealFeedService.updateListing(req.params.id, req.validated);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
    res.json({ listing: updated });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── DELETE /api/deal-feed/:id — archive listing ──────────────────────────────
app.delete('/api/deal-feed/:id', (req, res) => {
  try {
    const updated = DealFeedService.archiveListing(req.params.id);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
    res.json({ archived: true });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── POST /api/deal-feed/save — save listing for user ─────────────────────────
app.post('/api/deal-feed/save', validate(SaveListingSchema), (req, res) => {
  try {
    const { listingId, userId } = req.validated;
    const saved = DealFeedService.saveListing(userId, listingId);
    if (saved === null) {
      // Either already saved or listing not found
      const listing = DealFeedService.getListing(listingId);
      if (!listing) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
      return res.json({ saved: false, alreadySaved: true });
    }
    res.status(201).json({ saved: true, record: saved });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── DELETE /api/deal-feed/save — unsave listing ──────────────────────────────
app.delete('/api/deal-feed/save', (req, res) => {
  try {
    const userId    = req.query.userId    ? String(req.query.userId).slice(0, 100) : 'default';
    const listingId = req.query.listingId ? String(req.query.listingId)            : '';
    if (!listingId) return errorResponse(res, 400, 'VALIDATION_ERROR', 'listingId is required');
    const removed = DealFeedService.unsaveListing(userId, listingId);
    res.json({ removed });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── POST /api/deal-feed/import — import listing into CRM ─────────────────────
app.post('/api/deal-feed/import', validate(ImportListingSchema), (req, res) => {
  try {
    const { listingId } = req.validated;
    const result = DealFeedService.importToCRM(
      listingId,
      store,
      uid,
      nowIso(),
      ({ company, deal }) => {
        // Trigger automations for the newly created company and deal
        AutomationRuleEngine.fire('company_created',    { company },            serviceCtx);
        AutomationRuleEngine.fire('deal_stage_changed', { deal, stage: 'identified' }, serviceCtx);
        AutomationRuleEngine.fire('playbook_sync_on_company_created', {}, serviceCtx);
      }
    );
    if (!result) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
    res.status(result.alreadyImported ? 200 : 201).json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── POST /api/deal-feed/ingest/csv — bulk CSV ingest ─────────────────────────
app.post('/api/deal-feed/ingest/csv', validate(CsvIngestSchema), async (req, res) => {
  try {
    const { rows, source } = req.validated;
    // Run ingestion in-process but treat as background (fire and forget for large batches)
    const result = await DealFeedIngestionJob.ingestCsvRows(rows, source);
    res.json({ ingested: true, ...result });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── POST /api/deal-feed/:id/score — re-score a single listing ────────────────
app.post('/api/deal-feed/:id/score', (req, res) => {
  try {
    const listing = DealFeedService.getListing(req.params.id);
    if (!listing) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
    const score = DealFeedScoringService.applyScore(listing);
    const breakdown = DealFeedScoringService.breakdown(listing);
    res.json({ score, breakdown });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RELATIONSHIP MANAGEMENT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Zod schemas ──────────────────────────────────────────────────────────────


// ─── GET /api/relationships/dashboard ─────────────────────────────────────────
app.get('/api/relationships/dashboard', (req, res) => {
  try {
    res.json(RelationshipService.getDashboardData());
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/relationships — list ────────────────────────────────────────────
app.get('/api/relationships', (req, res) => {
  try {
    const {
      entityType, relationshipStatus, interestLevel, overdue,
      search, sortBy, sortDir, page, pageSize,
    } = req.query;

    const result = RelationshipService.listRelationships({
      entityType:         entityType         ? String(entityType)         : undefined,
      relationshipStatus: relationshipStatus ? String(relationshipStatus) : undefined,
      interestLevel:      interestLevel      ? String(interestLevel)      : undefined,
      overdue:            overdue === 'true'  ? true                      : undefined,
      search:             search             ? String(search).slice(0, 200) : undefined,
      sortBy:             sortBy             ? String(sortBy)             : 'nextFollowUpDate',
      sortDir:            sortDir            ? String(sortDir)            : 'asc',
      page:               page               ? parseInt(page, 10)        : 1,
      pageSize:           pageSize           ? parseInt(pageSize, 10)    : 50,
    });
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/relationships/:id ───────────────────────────────────────────────
app.get('/api/relationships/:id', (req, res) => {
  try {
    const rel = RelationshipService.getRelationship(req.params.id);
    if (!rel) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');
    const { interactions, total: interactionTotal } = RelationshipService.getInteractions(rel.id, { limit: 20 });
    res.json({ relationship: rel, interactions, interactionTotal });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── POST /api/relationships ──────────────────────────────────────────────────
app.post('/api/relationships', validate(RelationshipSchema), (req, res) => {
  try {
    const rel = RelationshipService.createRelationship(req.validated);
    res.status(201).json({ relationship: rel });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── PATCH /api/relationships/:id ─────────────────────────────────────────────
app.patch('/api/relationships/:id', validate(RelationshipPatchSchema), (req, res) => {
  try {
    const updated = RelationshipService.updateRelationship(req.params.id, req.validated);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');
    res.json({ relationship: updated });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── DELETE /api/relationships/:id ────────────────────────────────────────────
app.delete('/api/relationships/:id', (req, res) => {
  try {
    const deleted = RelationshipService.deleteRelationship(req.params.id);
    if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');
    res.json({ deleted: true });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/relationships/:id/interactions ──────────────────────────────────
app.get('/api/relationships/:id/interactions', (req, res) => {
  try {
    const rel = RelationshipService.getRelationship(req.params.id);
    if (!rel) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');
    const limit  = req.query.limit  ? parseInt(req.query.limit, 10)  : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    res.json(RelationshipService.getInteractions(req.params.id, { limit, offset }));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── POST /api/relationships/:id/interactions ─────────────────────────────────
app.post('/api/relationships/:id/interactions', validate(RelationshipInteractionSchema), (req, res) => {
  try {
    const interaction = RelationshipService.logInteraction(req.params.id, req.validated);
    if (!interaction) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');

    // Auto-calculate status after interaction
    const updated = RelationshipService.calculateRelationshipStatus(req.params.id);

    // Fire automation: seller interaction → playbook sync + deal momentum
    const rel = RelationshipService.getRelationship(req.params.id);
    if (rel?.entityType === 'seller') {
      AutomationRuleEngine.fire('interaction_logged', { relationship: rel, interaction }, serviceCtx);
    }

    res.status(201).json({ interaction, relationship: updated });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── PATCH /api/relationships/:id/interest-level ──────────────────────────────
app.patch('/api/relationships/:id/interest-level', (req, res) => {
  try {
    const { interestLevel } = req.body || {};
    const updated = RelationshipService.updateInterestLevel(req.params.id, interestLevel);
    if (!updated) return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid interestLevel or relationship not found');
    res.json({ relationship: updated });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── POST /api/relationships/:id/schedule-followup ────────────────────────────
app.post('/api/relationships/:id/schedule-followup', validate(ScheduleFollowUpSchema), (req, res) => {
  try {
    const updated = RelationshipService.scheduleNextFollowUp(req.params.id, req.validated.daysFromNow);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');
    res.json({ relationship: updated });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── POST /api/relationships/generate-tasks — manual trigger ──────────────────
app.post('/api/relationships/generate-tasks', (req, res) => {
  try {
    const created = RelationshipService.generateFollowUpTasks(store, uid, nowIso());
    res.json({ tasksCreated: created });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/relationships/execution-counts ──────────────────────────────────
app.get('/api/relationships/execution-counts', (req, res) => {
  try {
    res.json(RelationshipService.getExecutionCounts());
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATION KPI SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════


// ─── GET /api/conversations/kpi ───────────────────────────────────────────────
app.get('/api/conversations/kpi', (req, res) => {
  try {
    const weekStart = req.query.weekStart ? String(req.query.weekStart) : undefined;
    res.json(ConversationMetricsService.getKPIStatus(weekStart));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/conversations/weekly-report ─────────────────────────────────────
app.get('/api/conversations/weekly-report', (req, res) => {
  try {
    const weekStart = req.query.weekStart ? String(req.query.weekStart) : undefined;
    res.json(ConversationMetricsService.getWeeklyReport(weekStart));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/conversations/trends ────────────────────────────────────────────
app.get('/api/conversations/trends', (req, res) => {
  try {
    const weeksBack = req.query.weeks ? Math.min(52, parseInt(req.query.weeks, 10)) : 8;
    res.json({ trends: ConversationMetricsService.calculateConversationTrends(weeksBack) });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/conversations/pipeline-health ───────────────────────────────────
app.get('/api/conversations/pipeline-health', (req, res) => {
  try {
    res.json({ alerts: ConversationMetricsService.getPipelineHealthAlerts() });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/conversations/targets ───────────────────────────────────────────
app.get('/api/conversations/targets', (req, res) => {
  try {
    res.json({ targets: ConversationMetricsService.getTargets() });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── PATCH /api/conversations/targets ─────────────────────────────────────────
app.patch('/api/conversations/targets', validate(ConversationTargetSchema), (req, res) => {
  try {
    const { entityType, weeklyTarget } = req.validated;
    const updated = ConversationMetricsService.setTarget(entityType, weeklyTarget);
    res.json({ targets: updated });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/conversations — list ────────────────────────────────────────────
app.get('/api/conversations', (req, res) => {
  try {
    const { entityType, conversationType, search, dateFrom, dateTo, sortDir, page, pageSize } = req.query;
    res.json(ConversationMetricsService.listConversations({
      entityType:       entityType       ? String(entityType)       : undefined,
      conversationType: conversationType ? String(conversationType) : undefined,
      search:           search           ? String(search).slice(0, 200) : undefined,
      dateFrom:         dateFrom         ? String(dateFrom)         : undefined,
      dateTo:           dateTo           ? String(dateTo)           : undefined,
      sortDir:          sortDir          ? String(sortDir)          : 'desc',
      page:             page             ? parseInt(page, 10)       : 1,
      pageSize:         pageSize         ? parseInt(pageSize, 10)   : 50,
    }));
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── POST /api/conversations — record a conversation ──────────────────────────
app.post('/api/conversations', validate(ConversationSchema), (req, res) => {
  try {
    const conversation = ConversationMetricsService.recordConversation(req.validated);

    // Fire pipeline-health check automation after each new conversation
    const alerts = ConversationMetricsService.getPipelineHealthAlerts();
    for (const alert of alerts.filter((a) => a.severity === 'critical')) {
      const n = NotificationService.createNotification({
        type:     'system',
        title:    alert.title,
        message:  alert.message,
        priority: 'high',
      });
      store.notifications = [n, ...(store.notifications || [])].slice(0, 100);
    }

    res.status(201).json({ conversation });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── PATCH /api/conversations/:id ─────────────────────────────────────────────
app.patch('/api/conversations/:id', validate(ConversationPatchSchema), (req, res) => {
  try {
    const updated = ConversationMetricsService.updateConversation(req.params.id, req.validated);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Conversation not found');
    res.json({ conversation: updated });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── DELETE /api/conversations/:id ────────────────────────────────────────────
app.delete('/api/conversations/:id', (req, res) => {
  try {
    const deleted = ConversationMetricsService.deleteConversation(req.params.id);
    if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Conversation not found');
    res.json({ deleted: true });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── GET /api/conversations/agent-context ─────────────────────────────────────
app.get('/api/conversations/agent-context', (req, res) => {
  try {
    res.json(ConversationMetricsService.getAgentContext());
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// ─── Pipeline-health automation rule ──────────────────────────────────────────
AutomationRuleEngine.register({
  id: 'conversation_pipeline_health_daily',
  description: 'Daily check: fire notifications for pipeline health alert conditions',
  trigger: 'daily_check',
  condition: () => true,
  action: (_, { notificationService, store: s }) => {
    const alerts = ConversationMetricsService.getPipelineHealthAlerts();
    for (const alert of alerts) {
      const existing = (s.notifications || []).find(
        (n) => n.title === alert.title && !n.read
      );
      if (existing) continue; // already have an unread notification for this alert
      const n = notificationService.createNotification({
        type:     'system',
        title:    alert.title,
        message:  `${alert.message} ${alert.action}`,
        priority: alert.severity === 'critical' ? 'high' : 'medium',
      });
      s.notifications = [n, ...(s.notifications || [])].slice(0, 100);
    }
    return { alertsChecked: alerts.length };
  },
  enabled: true,
});

// ── Spec 4: Notifications ─────────────────────────────────────────────────

// GET /api/notifications — list all notifications, optionally filtered
app.get('/api/notifications', (req, res) => {
  try {
    let notifs = [...(store.notifications ?? [])];
    const { unread, pinned, severity, type } = req.query;

    if (unread === 'true')  notifs = notifs.filter((n) => !n.read_at);
    if (pinned === 'true')  notifs = notifs.filter((n) => n.pinned);
    if (severity)           notifs = notifs.filter((n) => n.severity === severity);
    if (type)               notifs = notifs.filter((n) => n.type === type);

    notifs.sort((a, b) => new Date(b.createdAt ?? b.created_at) - new Date(a.createdAt ?? a.created_at));
    res.json({ notifications: notifs, total: notifs.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve notifications');
  }
});

// POST /api/notifications/:id/read — mark a notification as read
app.post('/api/notifications/:id/read', (req, res) => {
  const notif = (store.notifications ?? []).find((n) => n.id === req.params.id);
  if (!notif) return errorResponse(res, 404, 'NOT_FOUND', 'Notification not found');
  NotificationService.markRead(notif);
  res.json({ id: notif.id, read_at: notif.read_at });
});

// POST /api/notifications/:id/dismiss — dismiss (soft-delete) a notification
app.post('/api/notifications/:id/dismiss', (req, res) => {
  const notif = (store.notifications ?? []).find((n) => n.id === req.params.id);
  if (!notif) return errorResponse(res, 404, 'NOT_FOUND', 'Notification not found');
  NotificationService.markDismissed(notif);
  res.json({ id: notif.id, dismissed_at: notif.dismissed_at });
});

// POST /api/notifications/mark-all-read — bulk mark all unread as read
app.post('/api/notifications/mark-all-read', (req, res) => {
  const unread = (store.notifications ?? []).filter((n) => !n.read_at && !n.dismissed_at);
  unread.forEach((n) => NotificationService.markRead(n));
  res.json({ marked_read: unread.length });
});

// ── Spec 4: Quick actions (mobile-first) ──────────────────────────────────

// POST /api/quick-log — log a quick touch/interaction on any entity
app.post('/api/quick-log', validate(z.object({
  entity_type:   z.enum(['contact', 'deal', 'investor', 'board_candidate']),
  entity_id:     z.string().min(1),
  interaction_type: z.enum(['call', 'email', 'meeting', 'text', 'note', 'linkedin']),
  notes:         z.string().max(2000).optional(),
  sentiment:     z.enum(['positive', 'neutral', 'negative', 'hot', 'warm', 'cold']).optional(),
  logged_by:     z.string().max(200).optional(),
})), (req, res) => {
  try {
    const { entity_type, entity_id, interaction_type, notes, sentiment, logged_by } = req.validated;
    const entry = {
      id:               uid(),
      entity_type,
      entity_id,
      interaction_type,
      notes:            notes ?? '',
      sentiment:        sentiment ?? 'neutral',
      logged_by:        logged_by ?? 'user',
      logged_at:        nowIso(),
    };

    // Persist into relevant store based on entity_type
    if (entity_type === 'contact') {
      store.interactions.push({ ...entry, contactId: entity_id });
    } else {
      store.interactions.push(entry);
    }

    res.status(201).json({ quick_log: entry });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to log quick interaction');
  }
});

// POST /api/quick-action/next-action/open — mark current next action as open/started
app.post('/api/quick-action/next-action/open', validate(z.object({
  task_id:    z.string().min(1),
  opened_by:  z.string().max(200).optional(),
  notes:      z.string().max(1000).optional(),
})), (req, res) => {
  try {
    const { task_id, opened_by, notes } = req.validated;
    const task = (store.tasks ?? []).find((t) => t.id === task_id);
    if (!task) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');
    task.status     = 'in_progress';
    task.started_at = nowIso();
    task.started_by = opened_by ?? 'user';
    if (notes) task.notes = notes;
    res.json({ task_id, status: 'in_progress', started_at: task.started_at });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to open next action');
  }
});

// POST /api/quick-action/proof-submit — submit proof for a task
app.post('/api/quick-action/proof-submit', validate(z.object({
  task_id:    z.string().min(1),
  proof_type: z.enum(['screenshot', 'email_thread', 'doc_link', 'verbal_confirm', 'system_event']),
  proof_url:  z.string().url().optional().or(z.literal('')),
  notes:      z.string().max(2000).optional(),
  submitted_by: z.string().max(200).optional(),
})), (req, res) => {
  try {
    const { task_id, proof_type, proof_url, notes, submitted_by } = req.validated;
    const task = (store.tasks ?? []).find((t) => t.id === task_id);
    if (!task) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');

    task.proof_status   = 'submitted';
    task.proof_type     = proof_type;
    task.proof_url      = proof_url ?? null;
    task.proof_notes    = notes ?? '';
    task.proof_submitted_at = nowIso();
    task.proof_submitted_by = submitted_by ?? 'user';

    res.json({ task_id, proof_status: 'submitted', submitted_at: task.proof_submitted_at });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to submit proof');
  }
});

// POST /api/quick-action/approve-and-send — approve artifact and immediately queue export
app.post('/api/quick-action/approve-and-send', validate(z.object({
  artifact_id:  z.string().min(1),
  approved_by:  z.string().min(1),
  export_type:  z.string().min(1),
  destination:  z.string().optional(),
  approval_note: z.string().max(1000).optional(),
})), (req, res) => {
  try {
    const { artifact_id, approved_by, export_type, destination, approval_note } = req.validated;

    // 1. Approve the artifact
    ArtifactStore.setApprovalStatus(artifact_id, 'approved', {
      reviewedBy:  approved_by,
      reviewNote:  approval_note ?? 'Approved via quick action',
      requestedBy: approved_by,
    });

    // 2. Queue the export
    const exportResult = ExportService.queueExport({
      artifactId:    artifact_id,
      exportType:    export_type,
      requestedBy:   approved_by,
      destination:   destination ?? null,
      exportOptions: { quick_action: true },
    });

    if (!exportResult.eligible) {
      return errorResponse(res, 422, 'EXPORT_NOT_ELIGIBLE', exportResult.reason ?? 'Export not eligible', { detail: exportResult.detail });
    }

    // 3. Immediately mark exported (optimistic for quick actions)
    ExportService.markReady(exportResult.export.export_id, { by: approved_by });
    ExportService.markExported(exportResult.export.export_id, { by: approved_by, destination });

    res.json({
      artifact_id,
      approved: true,
      export_id: exportResult.export.export_id,
      export_status: 'exported',
      warnings: exportResult.warnings,
    });
  } catch (err) {
    console.error('[quick-action/approve-and-send]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to approve and send artifact');
  }
});

// ── Spec 4: Enhanced Artifact Routes ──────────────────────────────────────

// POST /api/artifacts/generate — generate a new AI artifact
app.post('/api/artifacts/generate', validate(z.object({
  artifact_type:    z.string().min(1),
  entity_ids:       z.array(z.string()).optional(),
  context:          z.record(z.unknown()).optional(),
  requested_by:     z.string().max(200).optional(),
  format:           z.string().optional(),
  approval_required: z.boolean().optional(),
})), async (req, res) => {
  try {
    const { artifact_type, entity_ids = [], context = {}, requested_by, format, approval_required } = req.validated;

    const artifact = ArtifactStore.create({
      type:              artifact_type,
      title:             `Generated ${artifact_type}`,
      content:           '',
      generatedBySystem: true,
      createdBy:         requested_by ?? 'system',
      format:            format ?? 'markdown',
      entity_ids,
      approvalRequired:  approval_required,
      metadata:          { context, generation_requested_at: nowIso() },
    });

    // Trigger AI generation
    try {
      const result = await ModelGateway.run({
        taskType:     artifact_type,
        agentName:    'ArtifactGeneratorAgent',
        entityIds:    entity_ids,
        systemPrompt: `You are a document generation assistant for a private equity acquisition firm. Generate a ${artifact_type} document. Return structured content appropriate for the document type.`,
        userMessage:  JSON.stringify({ artifact_type, context }),
      });

      ArtifactStore.update(artifact.id, {
        content:       result.content,
        provider_used: result.provider_used,
        model_used:    result.model_used,
        generated_at:  nowIso(),
      });
      artifact.content       = result.content;
      artifact.provider_used = result.provider_used;
    } catch (aiErr) {
      console.warn('[artifacts/generate] AI generation failed, artifact saved as draft', aiErr.message);
    }

    res.status(201).json({ artifact: ArtifactStore.getSummary(artifact.id) });
  } catch (err) {
    console.error('[artifacts/generate]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate artifact');
  }
});

// POST /api/artifacts/:id/regenerate — regenerate content for an existing artifact
app.post('/api/artifacts/:id/regenerate', async (req, res) => {
  try {
    const existing = ArtifactStore.getById(req.params.id);
    if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Artifact not found');
    if (existing.status === 'archived') return errorResponse(res, 409, 'ARCHIVED', 'Cannot regenerate an archived artifact');

    // Create a new version in the same group
    const newVersion = ArtifactStore.create({
      type:              existing.artifactType,
      title:             existing.title,
      content:           '',
      generatedBySystem: true,
      createdBy:         req.body?.requested_by ?? 'system',
      format:            existing.format ?? 'markdown',
      groupId:           existing.groupId,
      metadata:          { ...existing.metadata, regenerated_from: existing.id, regenerated_at: nowIso() },
      approvalRequired:  existing.approvalRequired,
    });

    try {
      const result = await ModelGateway.run({
        taskType:     existing.artifactType,
        agentName:    'ArtifactGeneratorAgent',
        entityIds:    existing.entityIds ?? [],
        systemPrompt: `You are a document generation assistant. Regenerate the following document type with fresh content: ${existing.artifactType}`,
        userMessage:  JSON.stringify({ artifact_type: existing.artifactType, context: existing.metadata?.context ?? {}, revision_notes: req.body?.revision_notes ?? '' }),
      });

      ArtifactStore.update(newVersion.id, {
        content:      result.content,
        provider_used: result.provider_used,
        model_used:   result.model_used,
        generated_at: nowIso(),
      });
    } catch (aiErr) {
      console.warn('[artifacts/regenerate] AI failed, new version saved as empty draft', aiErr.message);
    }

    res.status(201).json({ artifact: ArtifactStore.getSummary(newVersion.id), previous_version_id: existing.id });
  } catch (err) {
    console.error('[artifacts/regenerate]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to regenerate artifact');
  }
});

// POST /api/artifacts/:id/archive — archive an artifact
app.post('/api/artifacts/:id/archive', validate(z.object({
  by:     z.string().min(1),
  reason: z.string().max(500).optional(),
})), (req, res) => {
  try {
    const artifact = ArtifactStore.getById(req.params.id);
    if (!artifact) return errorResponse(res, 404, 'NOT_FOUND', 'Artifact not found');
    ArtifactStore.archive(req.params.id, { by: req.validated.by, reason: req.validated.reason });
    res.json({ id: req.params.id, status: 'archived' });
  } catch (err) {
    console.error('[artifacts/archive]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to archive artifact');
  }
});

// POST /api/artifacts/:id/export — queue artifact for export
app.post('/api/artifacts/:id/export', validate(z.object({
  export_type:    z.string().min(1),
  requested_by:   z.string().min(1),
  destination:    z.string().optional(),
  export_options: z.record(z.unknown()).optional(),
})), (req, res) => {
  try {
    const { export_type, requested_by, destination, export_options } = req.validated;

    const result = ExportService.queueExport({
      artifactId:    req.params.id,
      exportType:    export_type,
      requestedBy:   requested_by,
      destination:   destination ?? null,
      exportOptions: export_options ?? {},
    });

    if (!result.eligible) {
      return errorResponse(res, 422, 'EXPORT_NOT_ELIGIBLE', result.reason ?? 'Export not eligible', { detail: result.detail, warnings: result.warnings });
    }

    res.status(202).json({
      export_id:    result.export.export_id,
      status:       result.export.status,
      warnings:     result.warnings,
      artifact_id:  req.params.id,
    });
  } catch (err) {
    console.error('[artifacts/export]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to queue artifact export');
  }
});

// ── Spec 4: Export management ────────────────────────────────────────────────

// GET /api/exports — list export records
app.get('/api/exports', (req, res) => {
  try {
    const filters = {};
    if (req.query.status)      filters.status      = req.query.status;
    if (req.query.export_type) filters.exportType   = req.query.export_type;
    if (req.query.stale_only)  filters.staleOnly    = req.query.stale_only === 'true';
    res.json({ exports: ExportService.query(filters) });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve exports');
  }
});

// GET /api/exports/:id — get a single export record
app.get('/api/exports/:id', (req, res) => {
  const record = ExportService.getById(req.params.id);
  if (!record) return errorResponse(res, 404, 'NOT_FOUND', 'Export not found');
  res.json(record);
});

// GET /api/exports/:id/audit — full provenance audit trail
app.get('/api/exports/:id/audit', (req, res) => {
  const trail = ExportService.getAuditTrail(req.params.id);
  if (!trail) return errorResponse(res, 404, 'NOT_FOUND', 'Export not found');
  res.json(trail);
});

// POST /api/exports/:id/complete — mark export as completed/delivered
app.post('/api/exports/:id/complete', validate(z.object({
  by:          z.string().min(1),
  destination: z.string().optional(),
  note:        z.string().max(500).optional(),
})), (req, res) => {
  try {
    const { by, destination, note } = req.validated;
    ExportService.markReady(req.params.id, { by });
    const record = ExportService.markExported(req.params.id, { by, note, destination });
    if (!record) return errorResponse(res, 404, 'NOT_FOUND', 'Export not found');
    res.json({ export_id: record.export_id, status: record.status, completed_at: record.completed_at });
  } catch (err) {
    if (err.message?.includes('invalid transition')) {
      return errorResponse(res, 409, 'INVALID_TRANSITION', err.message);
    }
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to complete export');
  }
});

// POST /api/exports/:id/cancel — cancel a queued export
app.post('/api/exports/:id/cancel', validate(z.object({
  by:     z.string().min(1),
  reason: z.string().max(500).optional(),
})), (req, res) => {
  try {
    const record = ExportService.cancelExport(req.params.id, { by: req.validated.by, reason: req.validated.reason });
    if (!record) return errorResponse(res, 404, 'NOT_FOUND', 'Export not found');
    res.json({ export_id: record.export_id, status: record.status });
  } catch (err) {
    if (err.message?.includes('invalid transition')) {
      return errorResponse(res, 409, 'INVALID_TRANSITION', err.message);
    }
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to cancel export');
  }
});

// ─── Negotiation Coach (QLA Step 10) ─────────────────────────────────────────

app.get('/api/negotiation/scenarios', (_req, res) => {
  res.json({
    scenarios: Object.entries(NEGOTIATION_SCENARIOS).map(([key, def]) => ({
      key, label: def.label, description: def.description, counterpartyRole: def.sellerRole,
    })),
  });
});

app.get('/api/negotiation/draft-types', (_req, res) => {
  res.json({
    draftTypes: Object.entries(DRAFT_TYPES).map(([key, def]) => ({
      key, label: def.label, tone: def.tone, audience: def.audience,
    })),
  });
});

app.post('/api/negotiation/simulate', async (req, res) => {
  try {
    const { sessionId, dealId, companyId, contactId, scenario, role = 'buyer', userMessage } = req.body;
    if (!scenario) return res.status(400).json({ error: { code: 'MISSING_FIELD', message: 'scenario is required' } });
    if (!NEGOTIATION_SCENARIOS[scenario]) return res.status(400).json({ error: { code: 'INVALID_SCENARIO', message: `Unknown scenario: ${scenario}` } });
    if (!userMessage) return res.status(400).json({ error: { code: 'MISSING_FIELD', message: 'userMessage is required' } });
    NegotiationService.init(store);
    const context = NegotiationService.buildSimulationContext({ dealId, companyId, contactId, scenario, role });
    let session = sessionId ? NegotiationService.getSession(sessionId) : null;
    if (!session) session = NegotiationService.createSession({ dealId, companyId, contactId, scenario, role, context });
    const coachOutput = await NegotiationService.runSimulationTurn({ sessionId: session.id, context, userMessage, sessionHistory: session.history });
    NegotiationService.appendToSession(session.id, userMessage, coachOutput);
    res.json({ sessionId: session.id, scenario, turn: Math.floor(session.history.length / 2), ...coachOutput });
  } catch (err) { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } }); }
});

app.get('/api/negotiation/sessions', (req, res) => {
  NegotiationService.init(store);
  const { dealId, companyId, limit = 20 } = req.query;
  let sessions = store.negotiationSessions || [];
  if (dealId)    sessions = sessions.filter(s => s.dealId === dealId);
  if (companyId) sessions = sessions.filter(s => s.companyId === companyId);
  res.json({ sessions: sessions.slice(0, Math.min(Number(limit), 100)) });
});

app.get('/api/negotiation/sessions/:id', (req, res) => {
  NegotiationService.init(store);
  const session = NegotiationService.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
  res.json(session);
});

app.post('/api/negotiation/recap', async (req, res) => {
  try {
    NegotiationService.init(store);
    const { meetingId, transcript, notes, summary, dealId, companyId, autoCreateTasks = true } = req.body;
    if (!transcript && !notes && !summary) return res.status(400).json({ error: { code: 'MISSING_INPUT', message: 'At least one of transcript, notes, or summary is required' } });
    const recap = await NegotiationService.processRecap({ meetingId, transcript, notes, summary, dealId, companyId, autoCreateTasks });
    res.status(201).json({ recap });
  } catch (err) { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } }); }
});

app.get('/api/negotiation/recaps', (req, res) => {
  NegotiationService.init(store);
  const { dealId, companyId, limit = 20 } = req.query;
  const recaps = NegotiationService.listRecaps({ dealId, companyId, limit: Number(limit) });
  res.json({ recaps, total: recaps.length });
});

app.get('/api/negotiation/recaps/:id', (req, res) => {
  NegotiationService.init(store);
  const recap = NegotiationService.getRecap(req.params.id);
  if (!recap) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recap not found' } });
  res.json(recap);
});

app.post('/api/negotiation/draft', async (req, res) => {
  try {
    NegotiationService.init(store);
    const { recapId, meetingId, dealId, companyId, draftType, additionalContext } = req.body;
    if (!draftType) return res.status(400).json({ error: { code: 'MISSING_FIELD', message: 'draftType is required' } });
    if (!DRAFT_TYPES[draftType]) return res.status(400).json({ error: { code: 'INVALID_DRAFT_TYPE', message: `Unknown draftType: ${draftType}` } });
    const draft = await NegotiationService.generateDraft({ recapId, meetingId, dealId, companyId, draftType, additionalContext });
    res.json({ draft });
  } catch (err) { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } }); }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  errorResponse(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`);
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err.message?.includes('CORS')) {
    return errorResponse(res, 403, 'CORS_ERROR', 'Cross-origin request blocked');
  }
  console.error('[Unhandled error]', { id: req.id, path: req.path, message: err.message });
  errorResponse(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
});

// ─── Start server ─────────────────────────────────────────────────────────────
// Sync IntegrationRegistry with settings (runs in all environments)
IntegrationRegistry.syncFromSettings(store.settings);

// ─── Capital Raising services init ───────────────────────────────────────────
InvestorCRMService.init(store);
CapitalStackService.init(store);
InvestorMemoService.init(store, AIService);
FirmMessagingService.init(store, AIService);
PitchDeckService.init(store, AIService);

// ─── Execution Tracker init ───────────────────────────────────────────────────
ExecutionTrackerService.init(store);

// ─── Playbook Engine init ─────────────────────────────────────────────────────
PlaybookService.init(store);

// ─── Deal Feed init ───────────────────────────────────────────────────────────
DealFeedService.init(store);

// ─── Relationship Management Engine init ──────────────────────────────────────
RelationshipService.init(store);

// ─── Conversation KPI System init ─────────────────────────────────────────────
ConversationMetricsService.init(store);

// Initialize new platform services
SourceAdapterRegistryService.init(store, store.settings);
SourcingRadarService.init(store);
MeetingPreparationService.init(store);

// Initialize deal probability for existing active deals
if (store.settings?.enableProbabilityScoring !== false) {
  DealProbabilityService.refreshAllActiveDealProbabilities(store);
}

// Register new automation rules
// ─── Capital Raising Automation Rules ────────────────────────────────────────
AutomationRuleEngine.register({
  id: 'investor_follow_up_reminder',
  description: 'When investor has not been contacted in 30 days → create follow-up task',
  trigger: 'daily_check',
  condition: () => true,
  action: (_, { store: s, taskService, uid, nowIso }) => {
    const stale = InvestorCRMService.getStaleInvestors(30);
    const existingTaskSubjects = new Set(
      (s.tasks || [])
        .filter((t) => t.status !== 'done' && t.title?.startsWith('[Investor Follow-up]'))
        .map((t) => t.title)
    );
    let created = 0;
    for (const inv of stale) {
      const title = `[Investor Follow-up] Reach out to ${inv.name}`;
      if (!existingTaskSubjects.has(title)) {
        taskService.createTask({
          id:          uid(),
          title,
          description: `${inv.name} at ${inv.organization || 'N/A'} has not been contacted in over 30 days.`,
          dueDate:     nowIso(),
          priority:    'medium',
          status:      'todo',
          entityType:  'investor',
          entityId:    inv.id,
        }, s);
        created++;
      }
    }
    return { staleCount: stale.length, tasksCreated: created };
  },
  enabled: true,
});

AutomationRuleEngine.register({
  id: 'investor_interest_stage_upgrade',
  description: 'When investor expresses interest → update relationshipStage to engaged',
  trigger: 'investor_engaged',
  condition: (ctx) => !!ctx.investor?.id,
  action: (ctx, { notificationService, store: s, nowIso }) => {
    const updated = InvestorCRMService.updateInvestor(
      ctx.investor.id,
      { relationshipStage: 'engaged', lastInteractionAt: nowIso() },
      nowIso()
    );
    if (updated) {
      const n = notificationService.createNotification({
        type:       'system',
        title:      `Investor engaged: ${updated.name}`,
        message:    `${updated.name} has expressed interest. Relationship stage updated to Engaged.`,
        priority:   'medium',
        entityType: 'investor',
        entityId:   updated.id,
      });
      s.notifications = [n, ...(s.notifications || [])].slice(0, 50);
    }
    return { updated: !!updated };
  },
  enabled: true,
});

// ─── Execution Tracker Automation Rules ──────────────────────────────────────

AutomationRuleEngine.register({
  id: 'execution_stalled_deal_notify',
  description: 'When a deal is marked stalled → notify operator with momentum context',
  trigger: 'deal_stalled',
  condition: (ctx) => !!ctx.deal?.id,
  action: (ctx, { notificationService, store: s, nowIso: _nowIso }) => {
    const momentum = ExecutionTrackerService.calculateMomentumStats();
    const dealMom  = momentum.find((m) => m.dealId === ctx.deal.id);
    const msg = dealMom
      ? `${ctx.deal.companyName || ctx.deal.name} — ${dealMom.daysSinceLastContact ?? '?'} days since last contact. Score: ${dealMom.momentumScore}/100. Action: ${dealMom.nextActionRequired}`
      : `${ctx.deal.companyName || ctx.deal.name} has stalled. Re-engage the owner immediately.`;
    const n = notificationService.createNotification({
      type:       'deal_alert',
      title:      `Stalled deal: ${ctx.deal.companyName || ctx.deal.name}`,
      message:    msg,
      priority:   'high',
      entityType: 'deal',
      entityId:   ctx.deal.id,
    });
    s.notifications = [n, ...(s.notifications || [])].slice(0, 50);
    return { notified: true };
  },
  enabled: true,
});

AutomationRuleEngine.register({
  id: 'execution_daily_alert_check',
  description: 'Daily check — fire alerts if execution metrics are below threshold',
  trigger: 'daily_tick',
  condition: () => true,
  action: (_, { notificationService, store: s }) => {
    const summary = ExecutionTrackerService.getExecutionSummary();
    const critical = summary.alerts.filter((a) => a.level === 'critical');
    for (const alert of critical) {
      const n = notificationService.createNotification({
        type:     'system',
        title:    'Execution Alert',
        message:  alert.message,
        priority: 'high',
      });
      s.notifications = [n, ...(s.notifications || [])].slice(0, 50);
    }
    return { alertsFired: critical.length };
  },
  enabled: true,
});

// ─── Playbook Automation Rules ────────────────────────────────────────────────

AutomationRuleEngine.register({
  id: 'playbook_sync_on_company_created',
  description: 'When company created → sync automatic playbook tasks',
  trigger: 'company_created',
  condition: () => true,
  action: () => {
    const synced = PlaybookService.syncAutomaticTasks();
    return { synced };
  },
  enabled: true,
});

AutomationRuleEngine.register({
  id: 'playbook_sync_on_interaction_logged',
  description: 'When interaction logged → sync automatic playbook tasks',
  trigger: 'interaction_logged',
  condition: () => true,
  action: () => {
    const synced = PlaybookService.syncAutomaticTasks();
    return { synced };
  },
  enabled: true,
});

AutomationRuleEngine.register({
  id: 'playbook_sync_on_deal_stage_changed',
  description: 'When deal stage changes → sync automatic playbook tasks + notify on stage completion',
  trigger: 'deal_stage_changed',
  condition: () => true,
  action: (ctx, { notificationService, store: s }) => {
    const synced = PlaybookService.syncAutomaticTasks();
    // Check if the current playbook stage just became complete
    const { stage, completion } = PlaybookService.getCurrentStage();
    if (completion?.complete) {
      const stages   = PlaybookService.getStages();
      const idx      = stages.findIndex((st) => st.id === stage.id);
      const nextStage = stages[idx + 1];
      if (nextStage) {
        const n = notificationService.createNotification({
          type:    'system',
          title:   `Playbook stage complete: ${stage.stageName}`,
          message: `Well done! Advancing to Stage ${nextStage.stageOrder}: ${nextStage.stageName}.`,
          priority: 'medium',
        });
        s.notifications = [n, ...(s.notifications || [])].slice(0, 50);
      }
    }
    return { synced };
  },
  enabled: true,
});

AutomationRuleEngine.register({
  id: 'generate_prep_on_meeting_confirmed',
  description: 'When meeting confirmed or scheduled → generate prep packet (deterministic)',
  trigger: 'meeting_confirmed',
  condition: (ctx) => !!ctx.meeting?.id && store.settings?.autoGeneratePrepPackets !== false,
  action: async (ctx) => {
    try {
      const packet = await MeetingPreparationService.buildPrepPacket(ctx.meeting.id, false);
      return { generated: true, packetId: packet?.id };
    } catch (err) {
      return { generated: false, error: err.message };
    }
  },
  enabled: true,
});

AutomationRuleEngine.register({
  id: 'generate_prep_on_meeting_scheduled',
  description: 'When meeting scheduled → generate prep packet (deterministic)',
  trigger: 'meeting_scheduled',
  condition: (ctx) => !!ctx.meeting?.id && store.settings?.autoGeneratePrepPackets !== false,
  action: async (ctx) => {
    try {
      const packet = await MeetingPreparationService.buildPrepPacket(ctx.meeting.id, false);
      return { generated: true, packetId: packet?.id };
    } catch (err) {
      return { generated: false, error: err.message };
    }
  },
  enabled: true,
});

AutomationRuleEngine.register({
  id: 'recompute_probability_on_interaction',
  description: 'When new interaction logged → recompute deal probability for linked deal',
  trigger: 'interaction_logged',
  condition: (ctx) => !!ctx.interaction?.dealId && store.settings?.enableProbabilityScoring !== false,
  action: (ctx) => {
    const deal = store.deals.find((d) => d.id === ctx.interaction.dealId);
    if (deal) DealProbabilityService.refreshDealProbability(deal, store);
    return { refreshed: !!deal };
  },
  enabled: true,
});

AutomationRuleEngine.register({
  id: 'recompute_probability_on_stage_change',
  description: 'When deal stage changes → recompute probability score',
  trigger: 'deal_stage_changed',
  condition: (ctx) => !!ctx.deal?.id && store.settings?.enableProbabilityScoring !== false,
  action: (ctx) => {
    const deal = store.deals.find((d) => d.id === ctx.deal.id);
    if (deal) DealProbabilityService.refreshDealProbability(deal, store);
    return { refreshed: !!deal };
  },
  enabled: true,
});

AutomationRuleEngine.register({
  id: 'recompute_probability_on_scenario_saved',
  description: 'When underwriting scenario saved → recompute probability score',
  trigger: 'scenario_saved',
  condition: (ctx) => !!ctx.scenario?.dealId && store.settings?.enableProbabilityScoring !== false,
  action: (ctx) => {
    const deal = store.deals.find((d) => d.id === ctx.scenario.dealId);
    if (deal) DealProbabilityService.refreshDealProbability(deal, store);
    return { refreshed: !!deal };
  },
  enabled: true,
});

AutomationRuleEngine.register({
  id: 'high_priority_sourcing_candidate_notify',
  description: 'When high-relevance sourcing candidate created → notify operator',
  trigger: 'sourcing_candidate_created',
  condition: (ctx) => (ctx.candidate?.relevanceScore || 0) >= (store.settings?.sourcingMinRelevanceThreshold || 50),
  action: (ctx, { notificationService, store: s }) => {
    const n = notificationService.createNotification({
      type: 'system',
      title: `High-priority sourcing target: ${ctx.candidate.name}`,
      message: `Score ${ctx.candidate.relevanceScore}/100 — ${ctx.candidate.industry || 'Unknown industry'} in ${ctx.candidate.city || ''} ${ctx.candidate.state || ''}. Review in Sourcing Radar.`,
      priority: 'high',
      entityType: 'sourcing_radar_candidate',
      entityId: ctx.candidate.id,
    });
    s.notifications = [n, ...(s.notifications || [])].slice(0, 50);
    return { notified: true };
  },
  enabled: true,
});

if (process.env.NODE_ENV !== 'test') {
  // ─── Event-driven AI automation rules (approval-gated) ─────────────────────
  // These rules fire when the operator enters data (company added, interaction
  // logged, deal stage changed). Agents draft outputs but NEVER send or apply
  // anything without explicit operator approval via /api/approvals.
  //
  // All rules are disabled when ANTHROPIC_API_KEY is not set.

  if (process.env.ANTHROPIC_API_KEY) {

    // ── company_created → draft initial outreach email ──────────────────────
    AutomationRuleEngine.register({
      id: 'ai_draft_outreach_on_company_created',
      description: 'When a company is added to CRM → AI drafts first outreach email for operator approval',
      trigger: 'company_created',
      condition: (ctx) => !!ctx.company?.id && ctx.company.status !== 'closed' && ctx.company.status !== 'lost',
      action: async (ctx, { store: s, notificationService }) => {
        const { company } = ctx;
        try {
          const result = await AgentOrchestrator.run('OutreachGenerationAgent', {
            company,
            contacts:     s.contacts.filter((c) => c.companyId === company.id),
            interactions: s.interactions.filter((i) => i.companyId === company.id),
            sequenceType: 'initial_contact',
            costFlags:    s.settings,
          });

          const draft = result?.email ?? result?.draft ?? result?.output;
          if (!draft) return { skipped: true, reason: 'no_draft_produced' };

          const approval = ApprovalService.createApproval({
            artifactType:  'seller_email',
            approvalScope: 'send_message',
            agentName:     'OutreachGenerationAgent',
            entityType:    'company',
            entityId:      company.id,
            submittedBy:   'system',
            autoSubmit:    true,
            draft: {
              subject: draft.subject ?? `Introduction — ${company.name}`,
              body:    draft.body ?? draft,
              to:      company.ownerEmail ?? '',
              context: { companyId: company.id, companyName: company.name, trigger: 'company_created' },
            },
          });

          const n = notificationService.createNotification({
            type:       'ai_draft',
            title:      `Outreach draft ready: ${company.name}`,
            message:    `AI drafted an initial outreach email for ${company.ownerName || company.name}. Review and approve before sending.`,
            priority:   'high',
            entityType: 'approval',
            entityId:   approval.id,
            actionUrl:  `/approvals/${approval.id}`,
          });
          s.notifications = [n, ...(s.notifications || [])].slice(0, 100);
          return { approvalId: approval.id, draftReady: true };
        } catch (err) {
          console.error('[ai_draft_outreach_on_company_created]', err.message);
          return { error: err.message };
        }
      },
      enabled: true,
    });

    // ── interaction_logged → draft follow-up email ──────────────────────────
    AutomationRuleEngine.register({
      id: 'ai_draft_follow_up_on_interaction',
      description: 'When an interaction is logged → AI drafts follow-up email for operator approval',
      trigger: 'interaction_logged',
      condition: (ctx) => {
        const i = ctx.interaction;
        return !!i?.id && (i.interactionType === 'email' || i.interactionType === 'call' || i.interactionType === 'meeting');
      },
      action: async (ctx, { store: s, notificationService }) => {
        const { interaction } = ctx;
        const company = interaction.companyId ? s.companies.find((c) => c.id === interaction.companyId) : null;
        const contact = interaction.contactId ? s.contacts.find((c) => c.id === interaction.contactId) : null;
        if (!company && !contact) return { skipped: true, reason: 'no_linked_entity' };

        try {
          const result = await AgentOrchestrator.run('OutreachGenerationAgent', {
            company:         company ?? null,
            contact:         contact ?? null,
            interactions:    s.interactions
              .filter((i) => i.companyId === interaction.companyId || i.contactId === interaction.contactId)
              .slice(0, 10),
            lastInteraction: interaction,
            sequenceType:    'follow_up',
            costFlags:       s.settings,
          });

          const draft = result?.email ?? result?.draft ?? result?.output;
          if (!draft) return { skipped: true, reason: 'no_draft_produced' };

          const entityName = company?.name ?? contact?.name ?? 'Contact';
          const toEmail    = contact?.email ?? company?.ownerEmail ?? '';

          const approval = ApprovalService.createApproval({
            artifactType:  'seller_email',
            approvalScope: 'send_message',
            agentName:     'OutreachGenerationAgent',
            entityType:    company ? 'company' : 'contact',
            entityId:      company?.id ?? contact?.id,
            submittedBy:   'system',
            autoSubmit:    true,
            draft: {
              subject: draft.subject ?? `Follow-up — ${entityName}`,
              body:    draft.body ?? draft,
              to:      toEmail,
              context: {
                companyId:     company?.id,
                contactId:     contact?.id,
                interactionId: interaction.id,
                trigger:       'interaction_logged',
              },
            },
          });

          const n = notificationService.createNotification({
            type:       'ai_draft',
            title:      `Follow-up draft ready: ${entityName}`,
            message:    `After your ${interaction.interactionType} with ${entityName}, AI drafted a follow-up. Review and approve before sending.`,
            priority:   'high',
            entityType: 'approval',
            entityId:   approval.id,
            actionUrl:  `/approvals/${approval.id}`,
          });
          s.notifications = [n, ...(s.notifications || [])].slice(0, 100);
          return { approvalId: approval.id, draftReady: true };
        } catch (err) {
          console.error('[ai_draft_follow_up_on_interaction]', err.message);
          return { error: err.message };
        }
      },
      enabled: true,
    });

    // ── deal_stage_changed → draft stage-appropriate email ──────────────────
    AutomationRuleEngine.register({
      id: 'ai_draft_on_deal_stage_change',
      description: 'When a deal advances stage → AI drafts a contextual email for operator approval',
      trigger: 'deal_stage_changed',
      condition: (ctx) => {
        const actionableStages = ['contacted', 'discovery', 'loi_discussion', 'due_diligence'];
        return actionableStages.includes(ctx.stage ?? ctx.deal?.stage);
      },
      action: async (ctx, { store: s, notificationService }) => {
        const { deal, stage } = ctx;
        const company = deal.companyId ? s.companies.find((c) => c.id === deal.companyId) : null;

        const sequenceMap = {
          contacted:      'discovery_call_request',
          discovery:      'financial_document_request',
          loi_discussion: 'loi_intro',
          due_diligence:  'diligence_kickoff',
        };
        const sequenceType = sequenceMap[stage] ?? 'follow_up';

        try {
          const result = await AgentOrchestrator.run('OutreachGenerationAgent', {
            company:      company ?? null,
            deal,
            interactions: s.interactions.filter((i) => i.dealId === deal.id).slice(0, 8),
            sequenceType,
            dealStage:    stage,
            costFlags:    s.settings,
          });

          const draft = result?.email ?? result?.draft ?? result?.output;
          if (!draft) return { skipped: true, reason: 'no_draft_produced' };

          const entityName = company?.name ?? deal.companyName ?? deal.name ?? 'Deal';

          const approval = ApprovalService.createApproval({
            artifactType:  stage === 'loi_discussion' ? 'loi_draft' : 'seller_email',
            approvalScope: 'send_message',
            agentName:     'OutreachGenerationAgent',
            entityType:    'deal',
            entityId:      deal.id,
            submittedBy:   'system',
            autoSubmit:    true,
            draft: {
              subject: draft.subject ?? `Next steps — ${entityName}`,
              body:    draft.body ?? draft,
              to:      company?.ownerEmail ?? '',
              context: { dealId: deal.id, stage, trigger: 'deal_stage_changed' },
            },
          });

          const n = notificationService.createNotification({
            type:       'ai_draft',
            title:      `Stage email ready: ${entityName}`,
            message:    `Deal advanced to ${stage}. AI drafted a contextual email. Review and approve before sending.`,
            priority:   'high',
            entityType: 'approval',
            entityId:   approval.id,
            actionUrl:  `/approvals/${approval.id}`,
          });
          s.notifications = [n, ...(s.notifications || [])].slice(0, 100);
          return { approvalId: approval.id, draftReady: true };
        } catch (err) {
          console.error('[ai_draft_on_deal_stage_change]', err.message);
          return { error: err.message };
        }
      },
      enabled: true,
    });

  } // end if (ANTHROPIC_API_KEY)

  BackgroundJobRunner.init(store, AgentOrchestrator);

  // Register new background jobs
  BackgroundJobRunner.register({
    id: 'runSourcingRadar',
    name: 'Run Sourcing Radar',
    intervalMs: 24 * 60 * 60 * 1000, // daily
    fn: async () => {
      if (!store.settings?.sourcingRadarEnabled) return;
      await SourcingRadarService.runScheduledScan({
        manual: false,
        triggeredBy: 'scheduler',
        settings: store.settings,
      });
    },
  });

  BackgroundJobRunner.register({
    id: 'recomputeDealProbabilities',
    name: 'Recompute Deal Probabilities',
    intervalMs: 6 * 60 * 60 * 1000, // every 6 hours
    fn: async () => {
      if (!store.settings?.enableProbabilityScoring) return;
      DealProbabilityService.refreshAllActiveDealProbabilities(store);
    },
  });

  BackgroundJobRunner.register({
    id: 'refreshSourceHealth',
    name: 'Refresh Source Adapter Health',
    intervalMs: 4 * 60 * 60 * 1000, // every 4 hours
    fn: async () => {
      await SourceAdapterRegistryService.runAllHealthChecks();
    },
  });

  BackgroundJobRunner.register({
    id: 'generateMissingPrepPackets',
    name: 'Generate Missing Prep Packets',
    intervalMs: 60 * 60 * 1000, // every hour
    fn: async () => {
      if (!store.settings?.autoGeneratePrepPackets) return;
      const reminderHours = store.settings?.prepPacketReminderHours || 24;
      const windowMs  = reminderHours * 60 * 60 * 1000;
      const now       = Date.now();
      const prepIds   = new Set((store.meetingPrepPackets || []).map((p) => p.meetingId));

      const needsPrep = (store.meetings || []).filter((m) => {
        if (!['confirmed', 'scheduled'].includes(m.status)) return false;
        if (prepIds.has(m.id)) return false;
        const minsUntil = new Date(m.startsAt).getTime() - now;
        return minsUntil > 0 && minsUntil <= windowMs;
      });

      for (const m of needsPrep) {
        try {
          await MeetingPreparationService.buildPrepPacket(m.id, false);
        } catch { /* skip */ }
      }
    },
  });

  BackgroundJobRunner.register({
    id: 'playbookAutoSync',
    name: 'Playbook Automatic Task Sync',
    intervalMs: 2 * 60 * 60 * 1000, // every 2 hours
    fn: async () => {
      PlaybookService.syncAutomaticTasks();
    },
  });

  BackgroundJobRunner.register({
    id: 'dealFeedIngestion',
    name: 'Deal Feed Ingestion',
    intervalMs: DealFeedIngestionJob.intervalMs,
    fn: async () => {
      await DealFeedIngestionJob.run(store);
    },
  });

  BackgroundJobRunner.register({
    id: 'dealFeedRescore',
    name: 'Deal Feed Re-score All Listings',
    intervalMs: 12 * 60 * 60 * 1000, // every 12 hours
    fn: async () => {
      DealFeedScoringService.rescoreAll(store.dealFeedListings || []);
    },
  });

  BackgroundJobRunner.register({
    id: 'relationshipFollowUp',
    name: RelationshipFollowUpJob.name,
    intervalMs: RelationshipFollowUpJob.intervalMs,
    fn: async (ctx) => RelationshipFollowUpJob.run(ctx),
  });

  BackgroundJobRunner.register({
    id: 'executionMomentumCheck',
    name: 'Deal Momentum Alert Check',
    intervalMs: 4 * 60 * 60 * 1000, // every 4 hours
    fn: async () => {
      const momentum = ExecutionTrackerService.calculateMomentumStats();
      const stalled  = momentum.filter((m) => m.riskLevel === 'stalled');
      for (const m of stalled) {
        const deal = store.deals.find((d) => d.id === m.dealId);
        if (deal) {
          AutomationRuleEngine.fire('deal_stalled', { deal }, serviceCtx);
        }
      }
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BATCH 2 ENGINES — Workflow, Proof, Scoring, Underwriting, Diligence, Seq
  // ══════════════════════════════════════════════════════════════════════════

  // ── Workflow ──────────────────────────────────────────────────────────────

  // GET /api/workflow/phases — full phase definitions
  app.get('/api/workflow/phases', (_req, res) => {
    res.json({ phases: Object.values(WorkflowEngine.PHASES), phase_order: WorkflowEngine.PHASE_ORDER });
  });

  // GET /api/workflow/status — detect current phase + readiness
  app.get('/api/workflow/status', (req, res) => {
    const ctx = req.query.ctx ? JSON.parse(req.query.ctx) : {};
    const result = WorkflowEngine.detectCurrentPhase(ctx);
    res.json(result);
  });

  // POST /api/workflow/evaluate-gates — check if a phase can be exited
  app.post('/api/workflow/evaluate-gates', (req, res) => {
    const { phase_key, ctx = {} } = req.body;
    if (!phase_key) return res.status(400).json({ error: 'phase_key required' });
    try {
      res.json(WorkflowEngine.evaluatePhaseGates(phase_key, ctx));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/workflow/evaluate-transition — check if transition is allowed
  app.post('/api/workflow/evaluate-transition', (req, res) => {
    const { from_phase, to_phase, ctx = {} } = req.body;
    if (!from_phase || !to_phase) return res.status(400).json({ error: 'from_phase and to_phase required' });
    res.json(WorkflowEngine.evaluateTransition(from_phase, to_phase, ctx));
  });

  // GET /api/next-action — calculate highest-value next action
  app.get('/api/next-action', (req, res) => {
    const {
      current_phase = 'targeting',
      tasks = [], deals = [], relationships = [], meetings = [],
      gates = [], scores = {}, proof_gaps = [],
    } = req.query.ctx ? JSON.parse(req.query.ctx) : {};
    res.json(NextActionEngine.calculate({ current_phase, tasks, deals, relationships, meetings, gates, scores, proof_gaps }));
  });

  // POST /api/next-action — body-based (for large contexts)
  app.post('/api/next-action', (req, res) => {
    const ctx = req.body ?? {};
    res.json(NextActionEngine.calculate(ctx));
  });

  // ── Proof ─────────────────────────────────────────────────────────────────

  // POST /api/tasks/:id/proof — validate and submit proof for a task
  app.post('/api/tasks/:id/proof', (req, res) => {
    const task     = store.tasks?.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const evidence = req.body.evidence ?? {};
    const result   = ProofEngine.validate(task, evidence);
    if (result.valid) {
      task.proof_status   = result.status;
      task.proof_evidence = result.evidence_summary;
    }
    res.json({ task_id: req.params.id, proof_result: result });
  });

  // POST /api/tasks/:id/proof/override — privileged manual override
  app.post('/api/tasks/:id/proof/override', (req, res) => {
    const { user_id, user_role, reason, override_to } = req.body;
    const result = ProofEngine.applyOverride({ task_id: req.params.id, overriding_user_id: user_id, overriding_user_role: user_role, reason, override_to });
    if (!result.allowed) return res.status(403).json({ error: result.error });
    const task = store.tasks?.find((t) => t.id === req.params.id);
    if (task) {
      task.proof_status   = result.override_record.override_status;
      task.override_reason = result.override_record.reason;
    }
    res.json(result.override_record);
  });

  // POST /api/tasks/:id/complete — complete a task (validates proof first)
  app.post('/api/tasks/:id/complete', async (req, res) => {
    const task = store.tasks?.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { quality, notes } = req.body;
    const { completeTask } = await import('./services/TaskService.js');
    const result = completeTask(task, { quality, notes });
    if (!result.success) return res.status(400).json({ error: result.error });
    Object.assign(task, result.task);
    res.json(result.task);
  });

  // POST /api/tasks/:id/block — mark a task as blocked
  app.post('/api/tasks/:id/block', (req, res) => {
    const task = store.tasks?.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.status       = 'blocked';
    task.block_reason = req.body.reason ?? 'Blocked';
    res.json(task);
  });

  // POST /api/tasks/:id/unblock — remove block from a task
  app.post('/api/tasks/:id/unblock', (req, res) => {
    const task = store.tasks?.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.status       = 'todo';
    task.block_reason = null;
    res.json(task);
  });

  // ── Scoring ───────────────────────────────────────────────────────────────

  // GET /api/scores/firm — firm-level health scores
  app.get('/api/scores/firm', (req, res) => {
    const data = req.query.ctx ? JSON.parse(req.query.ctx) : {};
    res.json(ScoringEngine.firmScores(data));
  });

  // POST /api/scores/deal/:id — all scores for a deal
  app.post('/api/scores/deal/:id', (req, res) => {
    const deal = store.deals?.find((d) => d.id === req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const { thesis = {}, diligence = {}, underwriting = {}, execution = {} } = req.body;
    res.json(ScoringEngine.dealScores(deal, { thesis, diligence, underwriting, execution }));
  });

  // POST /api/scores/relationship/:id
  app.post('/api/scores/relationship/:id', (req, res) => {
    const rel = store.relationships?.find((r) => r.id === req.params.id);
    if (!rel) return res.status(404).json({ error: 'Relationship not found' });
    res.json(ScoringEngine.relationshipStrengthScore(rel));
  });

  // ── Underwriting ──────────────────────────────────────────────────────────

  // GET /api/deals/:id/underwriting — run full underwriting on a deal
  app.get('/api/deals/:id/underwriting', (req, res) => {
    const deal = store.deals?.find((d) => d.id === req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json(UnderwritingEngine.runUnderwriting(deal));
  });

  // POST /api/deals/:id/underwriting/scenario — build a single custom scenario
  app.post('/api/deals/:id/underwriting/scenario', (req, res) => {
    const deal = store.deals?.find((d) => d.id === req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    try {
      const scenario = UnderwritingEngine.buildScenario({ ...req.body });
      res.json(scenario);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/deals/:id/underwriting/fatal-flag — flag a deal with a fatal issue
  app.post('/api/deals/:id/fatal-flag', (req, res) => {
    const deal = store.deals?.find((d) => d.id === req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const { flag_key, reason } = req.body;
    if (!flag_key) return res.status(400).json({ error: 'flag_key required' });
    if (!deal.fatal_flags) deal.fatal_flags = [];
    deal.fatal_flags.push({ flag_key, reason, flagged_at: new Date().toISOString() });
    res.json({ deal_id: deal.id, fatal_flags: deal.fatal_flags });
  });

  // POST /api/deals/:id/decision-log — log a deal decision
  app.post('/api/deals/:id/decision-log', (req, res) => {
    const deal = store.deals?.find((d) => d.id === req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    if (!deal.decision_log) deal.decision_log = [];
    deal.decision_log.push({ ...req.body, logged_at: new Date().toISOString() });
    res.json({ deal_id: deal.id, decision_log: deal.decision_log });
  });

  // POST /api/deals/:id/underwriting/commentary — AI commentary on underwriting (approval-gated)
  app.post('/api/deals/:id/underwriting/commentary', async (req, res) => {
    const deal = store.deals?.find((d) => d.id === req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const uw = UnderwritingEngine.runUnderwriting(deal);
    try {
      const result = await ModelGateway.run({
        taskType:        'deal_structure_commentary',
        agentName:       'UnderwritingCommentaryAgent',
        entityIds:       [deal.id],
        systemPrompt:    'You are an acquisition underwriting analyst. Provide structured commentary on the provided underwriting results. Be specific, factual, and actionable. Return JSON.',
        userMessage:     JSON.stringify({ underwriting: uw, deal: { name: deal.name, stage: deal.stage } }),
        approvalRequired: false,
      });
      uw.ai_commentary       = result.content;
      uw.ai_commentary_available = true;
      uw.provider_used       = result.provider_used;
      res.json(uw);
    } catch {
      uw.ai_commentary       = null;
      uw.ai_commentary_available = false;
      res.json(uw);
    }
  });

  // ── Diligence ─────────────────────────────────────────────────────────────

  // GET /api/deals/:id/diligence — completeness overview
  app.get('/api/deals/:id/diligence', (req, res) => {
    const deal   = store.deals?.find((d) => d.id === req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const issues = (store.diligenceIssues ?? []).filter((i) => i.deal_id === deal.id);
    const docs   = (store.documents ?? []).filter((d) => d.deal_id === deal.id);
    res.json(DiligenceEngine.overallCompleteness(issues, docs));
  });

  // POST /api/deals/:id/diligence/issues — create a diligence issue
  app.post('/api/deals/:id/diligence/issues', (req, res) => {
    const deal = store.deals?.find((d) => d.id === req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    try {
      const issue = DiligenceEngine.createIssue({ ...req.body, deal_id: deal.id });
      if (!store.diligenceIssues) store.diligenceIssues = [];
      store.diligenceIssues.push(issue);
      res.status(201).json(issue);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/deals/:id/diligence/questions — generate standard questions for a category
  app.post('/api/deals/:id/diligence/questions', async (req, res) => {
    const { category, use_ai = false } = req.body;
    const standard = DiligenceEngine.standardQuestions(category);
    if (!use_ai) return res.json({ questions: standard, source: 'standard_template' });
    try {
      const result = await ModelGateway.run({
        taskType:    'diligence_question_generation',
        agentName:   'DiligenceQuestionAgent',
        entityIds:   [req.params.id],
        systemPrompt: 'You are a diligence analyst. Enhance or supplement the provided standard questions based on the deal context. Return JSON array of question objects.',
        userMessage:  JSON.stringify({ standard_questions: standard, category, deal_id: req.params.id }),
        approvalRequired: false,
      });
      res.json({ questions: result.content?.questions ?? standard, source: 'ai_enhanced', provider_used: result.provider_used });
    } catch {
      res.json({ questions: standard, source: 'standard_template_fallback' });
    }
  });

  // POST /api/deals/:id/diligence/summary — AI summary of diligence state
  app.post('/api/deals/:id/diligence/summary', async (req, res) => {
    const deal   = store.deals?.find((d) => d.id === req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const issues = (store.diligenceIssues ?? []).filter((i) => i.deal_id === deal.id);
    const docs   = (store.documents ?? []).filter((d) => d.deal_id === deal.id);
    const completeness = DiligenceEngine.overallCompleteness(issues, docs);
    const grouped      = DiligenceEngine.groupBySeverity(issues);
    try {
      const result = await ModelGateway.run({
        taskType:    'complex_diligence_synthesis',
        agentName:   'DiligenceSummaryAgent',
        entityIds:   [deal.id],
        systemPrompt: 'Synthesize the diligence state for this deal. Identify patterns, key risks, and most critical next steps. Return structured JSON.',
        userMessage:  JSON.stringify({ completeness, grouped_issues: grouped, deal: { name: deal.name } }),
        approvalRequired: false,
      });
      res.json({ completeness, grouped_issues: grouped, ai_synthesis: result.content, provider_used: result.provider_used, fallback_used: result.fallback_used });
    } catch {
      res.json({ completeness, grouped_issues: grouped, ai_synthesis: null });
    }
  });

  // ── Sequence ──────────────────────────────────────────────────────────────

  // GET /api/outreach/sequences — list all sequence definitions
  app.get('/api/outreach/sequences', (_req, res) => {
    res.json({ sequences: Object.values(SequenceEngine.SEQUENCES) });
  });

  // POST /api/outreach/sequences/next-step — calculate next step for a sequence state
  app.post('/api/outreach/sequences/next-step', (req, res) => {
    const state = req.body;
    res.json(SequenceEngine.calculateNextStep(state));
  });

  // POST /api/outreach/sequences/advance — advance a sequence step
  app.post('/api/outreach/sequences/advance', (req, res) => {
    const { state, outcome, proof_reference } = req.body;
    if (!state || !outcome) return res.status(400).json({ error: 'state and outcome required' });
    res.json(SequenceEngine.advanceStep(state, { outcome, proof_reference }));
  });

  // POST /api/outreach/sequences/recommend — recommend sequence for a target
  app.post('/api/outreach/sequences/recommend', (req, res) => {
    const { audience, ctx = {} } = req.body;
    if (!audience) return res.status(400).json({ error: 'audience required' });
    const recommended = SequenceEngine.recommendSequence(audience, ctx);
    res.json({ audience, recommended_sequence: recommended, sequence: recommended ? SequenceEngine.SEQUENCES[recommended] : null });
  });

  // POST /api/outreach/draft — draft outreach copy via AI (approval-gated)
  app.post('/api/outreach/draft', async (req, res) => {
    const { template_key, context = {}, audience, approval_required = true } = req.body;
    if (!template_key) return res.status(400).json({ error: 'template_key required' });

    if (approval_required) {
      const approval = ApprovalService.createApproval({
        action_type:   'outbound_email_draft',
        action_label:  `Draft outreach: ${template_key}`,
        payload:       { template_key, context, audience },
        requested_by:  req.body.requested_by ?? 'system',
        approval_note: 'Outbound email draft requires review before send',
      });
      return res.status(202).json({ approval_required: true, approval_id: approval.id, status: 'pending_approval' });
    }

    try {
      const result = await ModelGateway.run({
        taskType:         'outreach_draft',
        agentName:        'OutreachDraftAgent',
        entityIds:        context.entity_ids ?? [],
        systemPrompt:     `You are an expert acquisition outreach copywriter. Draft a ${template_key} outreach message for the ${audience ?? 'seller'} audience. Return JSON with subject and body fields.`,
        userMessage:      JSON.stringify(context),
        approvalRequired: approval_required,
      });
      res.json({ template_key, draft: result.content, provider_used: result.provider_used, fallback_used: result.fallback_used });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Command center ────────────────────────────────────────────────────────

  // GET /api/command-center/summary — unified firm state snapshot
  app.get('/api/command-center/summary', (req, res) => {
    const thesis     = store.thesis       ?? {};
    const board      = store.board        ?? {};
    const tasks      = store.tasks        ?? [];
    const deals      = store.deals        ?? [];
    const rels       = store.relationships ?? [];
    const firmScores = ScoringEngine.firmScores({ thesis, board, execution: _executionCtx(tasks), momentum: _momentumCtx(tasks, deals) });
    const nextAction = NextActionEngine.calculate({ current_phase: store.current_phase ?? 'targeting', tasks, deals, relationships: rels });
    res.json({ firm_scores: firmScores, next_action: nextAction, generated_at: new Date().toISOString() });
  });

  // GET /api/command-center/alerts — critical items needing attention
  app.get('/api/command-center/alerts', (req, res) => {
    const tasks = store.tasks ?? [];
    const deals = store.deals ?? [];
    const now   = Date.now();
    const overdue = tasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now);
    const fatalDeals = deals.filter((d) => (d.fatal_flags ?? []).length > 0 && d.stage !== 'closed' && d.stage !== 'dead');
    const stalledDeals = deals.filter((d) => d.daysSinceActivity > 14 && d.stage !== 'closed');
    res.json({
      overdue_tasks:  overdue.slice(0, 10),
      fatal_flag_deals: fatalDeals.map((d) => ({ id: d.id, name: d.name, flags: d.fatal_flags })),
      stalled_deals:  stalledDeals.slice(0, 5).map((d) => ({ id: d.id, name: d.name, days_inactive: d.daysSinceActivity })),
      total_alerts:   overdue.length + fatalDeals.length + stalledDeals.length,
      generated_at:   new Date().toISOString(),
    });
  });

  app.listen(PORT, () => {
    console.info(`DEH backend running on port ${PORT} [${NODE_ENV}]`);
  });
}

// ─── Internal helpers for scoring context ────────────────────────────────────
function _executionCtx(tasks = []) {
  const required = tasks.filter((t) => t.is_required);
  const now = Date.now();
  const onTime = required.filter((t) => t.status === 'done' && (!t.dueDate || new Date(t.dueDate) >= now)).length;
  const proven = required.filter((t) => t.proof_status === 'proven' || t.proof_status === 'waived').length;
  return {
    required_tasks_on_time_pct: required.length ? Math.round((onTime / required.length) * 100) : 100,
    proof_completion_rate:      required.length ? Math.round((proven / required.length) * 100) : 100,
    stalled_count:              tasks.filter((t) => t.status === 'blocked').length,
  };
}

function _momentumCtx(tasks = [], deals = []) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;
  return {
    activity_7d:           tasks.filter((t) => t.completed_at && new Date(t.completed_at) > sevenDaysAgo).length,
    deal_stage_change_7d:  deals.some((d) => d.last_stage_change && new Date(d.last_stage_change) > sevenDaysAgo),
    overdue_count:         tasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now).length,
  };
}

export { app, store };
