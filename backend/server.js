import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { z } from 'zod';

dotenv.config();

// ─── Environment validation ───────────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY && process.env.NODE_ENV !== 'test') {
  console.error('FATAL: ANTHROPIC_API_KEY is not set.');
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

// Request ID for tracing
app.use((req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
});

// ─── Rate limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
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

// ─── Zod validation helpers ───────────────────────────────────────────────────
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
  settings: {
    fromName: '',
    fromEmail: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    emailMode: 'smtp_only',
    primaryModel: 'claude-sonnet-4-20250514',
    reducedMotion: false,
    highContrast: false,
    keyboardShortcutsEnabled: true,
    density: 'standard',
    aiDraftingEnabled: true,
    aiReplyEnabled: true,
    aiBriefingEnabled: true,
  },
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

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const CompanySchema = z.object({
  name: z.string().min(1).max(200).trim(),
  industry: z.string().max(100).trim().optional(),
  subIndustry: z.string().max(100).trim().optional(),
  website: z.string().url().optional().or(z.literal('')),
  phone: z.string().max(30).trim().optional(),
  email: z.string().email().optional().or(z.literal('')),
  city: z.string().max(100).trim().optional(),
  state: z.string().max(50).trim().optional(),
  ownerName: z.string().max(200).trim().optional(),
  estimatedRevenueLow: z.number().min(0).optional(),
  estimatedRevenueHigh: z.number().min(0).optional(),
  estimatedSDELow: z.number().min(0).optional(),
  estimatedSDEHigh: z.number().min(0).optional(),
  yearsInBusiness: z.number().min(0).max(500).optional(),
  notes: z.string().max(5000).trim().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  source: z.string().max(100).trim().optional(),
  status: z.enum(['target', 'contacted', 'conversation', 'interested', 'diligence', 'under_loi', 'under_contract', 'closed', 'lost', 'archived']).optional(),
  retirementSignal: z.boolean().optional(),
  noWebsiteSignal: z.boolean().optional(),
});

const ContactSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().max(100).trim().optional(),
  title: z.string().max(200).trim().optional(),
  companyId: z.string().uuid().optional().or(z.literal('')),
  contactType: z.enum(['seller', 'board_candidate', 'banker', 'attorney', 'cpa', 'capital_partner', 'operator', 'networking_contact', 'vendor', 'employee_candidate']).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).trim().optional(),
  notes: z.string().max(5000).trim().optional(),
});

const InteractionSchema = z.object({
  type: z.enum(['email', 'call', 'meeting', 'note', 'document_sent', 'proposal', 'loi', 'follow_up', 'research']),
  direction: z.enum(['inbound', 'outbound', 'internal']).optional(),
  companyId: z.string().uuid().optional().or(z.literal('')),
  contactId: z.string().uuid().optional().or(z.literal('')),
  dealId: z.string().uuid().optional().or(z.literal('')),
  subject: z.string().max(500).trim().optional(),
  notes: z.string().max(10000).trim().optional(),
  outcome: z.string().max(500).trim().optional(),
  requiresFollowUp: z.boolean().optional(),
  followUpDate: z.string().datetime().optional().or(z.literal('')),
});

const DealSchema = z.object({
  companyName: z.string().min(1).max(200).trim(),
  companyId: z.string().uuid().optional().or(z.literal('')),
  dealType: z.enum(['platform', 'add_on', 'other']).optional(),
  estimatedRevenue: z.number().min(0).optional(),
  estimatedSDE: z.number().min(0).optional(),
  askingPrice: z.number().min(0).optional(),
  notes: z.string().max(10000).trim().optional(),
  dealThesis: z.string().max(2000).trim().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  confidenceLevel: z.number().min(0).max(100).optional(),
  source: z.string().max(100).trim().optional(),
});

const TaskSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  description: z.string().max(5000).trim().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  dueDate: z.string().datetime().optional().or(z.literal('')),
  linkedEntityType: z.string().max(50).trim().optional(),
  linkedEntityId: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'archived']).optional(),
});

const BoardCandidateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  seatId: z.string().uuid().optional().or(z.literal('')),
  source: z.string().max(200).trim().optional(),
  status: z.enum(['identified', 'researched', 'outreach_sent', 'meeting_scheduled', 'interested', 'negotiating', 'confirmed', 'passed']).optional(),
  equityOffered: z.number().min(0).max(100).optional(),
  bio: z.string().max(5000).trim().optional(),
  notes: z.string().max(5000).trim().optional(),
});

const DocumentSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  content: z.string().max(100000),
  documentType: z.enum(['loi', 'board_invite', 'outreach_letter', 'follow_up_email', 'meeting_agenda', 'meeting_summary', 'deal_memo', 'diligence_checklist', 'board_update', 'post_acquisition_plan']),
  entityType: z.string().max(50).optional(),
  entityId: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(['draft', 'approved', 'sent', 'signed', 'archived']).optional(),
});

const ComposeSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(1000).trim(),
  body: z.string().max(50000).optional(),
  companyId: z.string().uuid().optional().or(z.literal('')),
  contactId: z.string().uuid().optional().or(z.literal('')),
});

const SettingsPatchSchema = z.object({
  fromName: z.string().max(200).trim().optional(),
  fromEmail: z.string().email().optional().or(z.literal('')),
  smtpHost: z.string().max(300).trim().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().max(300).trim().optional(),
  emailMode: z.enum(['smtp_only', 'imap_smtp', 'gmail_api']).optional(),
  primaryModel: z.string().max(100).trim().optional(),
  reducedMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  keyboardShortcutsEnabled: z.boolean().optional(),
  density: z.enum(['compact', 'standard', 'spacious']).optional(),
  aiDraftingEnabled: z.boolean().optional(),
  aiReplyEnabled: z.boolean().optional(),
  aiBriefingEnabled: z.boolean().optional(),
}).strict();

const UnderwritingCalcSchema = z.object({
  netIncome: z.number().finite().optional().default(0),
  ownerSalary: z.number().finite().optional().default(0),
  personalAddbacks: z.number().finite().optional().default(0),
  oneTimeAdjustments: z.number().finite().optional().default(0),
  marketRateManagement: z.number().finite().optional().default(0),
  askingPrice: z.number().min(0).finite().optional().default(0),
  downPaymentPct: z.number().min(0).max(100).optional().default(10),
  sellerNotePct: z.number().min(0).max(100).optional().default(0),
  seniorDebtRatePct: z.number().min(0).max(50).optional().default(6.5),
  seniorDebtTermMonths: z.number().int().min(1).max(360).optional().default(120),
  sellerNoteRatePct: z.number().min(0).max(50).optional().default(6),
  sellerNoteTermMonths: z.number().int().min(1).max(360).optional().default(60),
});

const ChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(20000),
    })
  ).min(1).max(50),
  system: z.string().max(5000).optional(),
});

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
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: nowIso(), env: NODE_ENV });
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
app.get('/api/companies', (req, res) => {
  try {
    const { status, search, industry } = req.query;
    let results = [...store.companies];

    if (status && typeof status === 'string') results = results.filter((c) => c.status === status);
    if (industry && typeof industry === 'string') results = results.filter((c) => c.industry === industry);
    if (search && typeof search === 'string') {
      const q = search.toLowerCase().slice(0, 100); // cap search length
      results = results.filter(
        (c) => c.name?.toLowerCase().includes(q) || c.ownerName?.toLowerCase().includes(q)
      );
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(results);
  } catch (err) {
    console.error('[GET /api/companies]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve companies');
  }
});

app.post('/api/companies', validate(CompanySchema), (req, res) => {
  try {
    const company = {
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: 'target',
      ...req.validated,
    };
    store.companies.push(company);
    res.status(201).json(company);
  } catch (err) {
    console.error('[POST /api/companies]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create company');
  }
});

app.get('/api/companies/:id', (req, res) => {
  try {
    const company = findById(store.companies, req.params.id);
    if (!company) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');

    const interactions = store.interactions.filter((i) => i.companyId === req.params.id);
    const deals = store.deals.filter((d) => d.companyId === req.params.id);
    res.json({ ...company, interactions, deals });
  } catch (err) {
    console.error('[GET /api/companies/:id]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve company');
  }
});

app.patch('/api/companies/:id', validate(CompanySchema.partial()), (req, res) => {
  try {
    const idx = store.companies.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
    store.companies[idx] = { ...store.companies[idx], ...req.validated, updatedAt: nowIso() };
    res.json(store.companies[idx]);
  } catch (err) {
    console.error('[PATCH /api/companies/:id]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update company');
  }
});

app.delete('/api/companies/:id', (req, res) => {
  try {
    const exists = findById(store.companies, req.params.id);
    if (!exists) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
    store.companies = store.companies.filter((c) => c.id !== req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error('[DELETE /api/companies/:id]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to delete company');
  }
});

// ─── Contacts ─────────────────────────────────────────────────────────────────
app.get('/api/contacts', (req, res) => {
  try {
    const { companyId, type } = req.query;
    let results = [...store.contacts];
    if (companyId && typeof companyId === 'string') results = results.filter((c) => c.companyId === companyId);
    if (type && typeof type === 'string') results = results.filter((c) => c.contactType === type);
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve contacts');
  }
});

app.post('/api/contacts', validate(ContactSchema), (req, res) => {
  try {
    const contact = {
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      fullName: [req.validated.firstName, req.validated.lastName].filter(Boolean).join(' '),
      ...req.validated,
    };
    store.contacts.push(contact);
    res.status(201).json(contact);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create contact');
  }
});

app.get('/api/contacts/:id', (req, res) => {
  try {
    const contact = findById(store.contacts, req.params.id);
    if (!contact) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
    const interactions = store.interactions.filter((i) => i.contactId === req.params.id);
    res.json({ ...contact, interactions });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve contact');
  }
});

app.patch('/api/contacts/:id', validate(ContactSchema.partial()), (req, res) => {
  try {
    const idx = store.contacts.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
    store.contacts[idx] = { ...store.contacts[idx], ...req.validated, updatedAt: nowIso() };
    res.json(store.contacts[idx]);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update contact');
  }
});

// ─── Interactions ─────────────────────────────────────────────────────────────
app.get('/api/interactions', (req, res) => {
  try {
    const { companyId, contactId, dealId } = req.query;
    let results = [...store.interactions];
    if (companyId && typeof companyId === 'string') results = results.filter((i) => i.companyId === companyId);
    if (contactId && typeof contactId === 'string') results = results.filter((i) => i.contactId === contactId);
    if (dealId && typeof dealId === 'string') results = results.filter((i) => i.dealId === dealId);
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve interactions');
  }
});

app.post('/api/interactions', validate(InteractionSchema), (req, res) => {
  try {
    const interaction = { id: uid(), createdAt: nowIso(), ...req.validated };
    store.interactions.push(interaction);

    if (interaction.companyId) {
      const idx = store.companies.findIndex((c) => c.id === interaction.companyId);
      if (idx !== -1) store.companies[idx].updatedAt = nowIso();
    }

    res.status(201).json(interaction);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create interaction');
  }
});

// ─── Deals ────────────────────────────────────────────────────────────────────
app.get('/api/deals', (req, res) => {
  try {
    const { status, stage } = req.query;
    let results = [...store.deals];
    if (status && typeof status === 'string') results = results.filter((d) => d.status === status);
    if (stage && typeof stage === 'string') results = results.filter((d) => d.stage === stage);
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve deals');
  }
});

app.post('/api/deals', validate(DealSchema), (req, res) => {
  try {
    const deal = {
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: 'active',
      stage: 'sourcing',
      ...req.validated,
    };
    store.deals.push(deal);
    res.status(201).json(deal);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create deal');
  }
});

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

app.patch('/api/deals/:id', validate(DealSchema.partial()), (req, res) => {
  try {
    const idx = store.deals.findIndex((d) => d.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Deal not found');
    store.deals[idx] = { ...store.deals[idx], ...req.validated, updatedAt: nowIso() };
    res.json(store.deals[idx]);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update deal');
  }
});

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
app.get('/api/tasks', (req, res) => {
  try {
    const { status, priority } = req.query;
    let results = [...store.tasks];
    if (status && typeof status === 'string') results = results.filter((t) => t.status === status);
    if (priority && typeof priority === 'string') results = results.filter((t) => t.priority === priority);
    results.sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve tasks');
  }
});

app.post('/api/tasks', validate(TaskSchema), (req, res) => {
  try {
    const task = {
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: 'todo',
      priority: 'medium',
      ...req.validated,
    };
    store.tasks.push(task);
    res.status(201).json(task);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create task');
  }
});

app.patch('/api/tasks/:id', validate(TaskSchema.partial()), (req, res) => {
  try {
    const idx = store.tasks.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');
    const updates = { ...req.validated, updatedAt: nowIso() };
    if (updates.status === 'done' && !store.tasks[idx].completedAt) {
      updates.completedAt = nowIso();
    }
    store.tasks[idx] = { ...store.tasks[idx], ...updates };
    res.json(store.tasks[idx]);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update task');
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const exists = findById(store.tasks, req.params.id);
    if (!exists) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');
    store.tasks = store.tasks.filter((t) => t.id !== req.params.id);
    res.status(204).end();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to delete task');
  }
});

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

const OutreachGenerateSchema = z.object({
  templateType: z.enum(['seller_outreach', 'seller_follow_up', 'board_outreach', 'lender_outreach', 'networking_outreach']),
  companyName: z.string().max(200).trim().optional(),
  ownerName: z.string().max(200).trim().optional(),
  context: z.string().max(1000).trim().optional(),
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
  const { smtpPassword, ...safeSettings } = store.settings;
  res.json(safeSettings);
});

app.patch('/api/settings', validate(SettingsPatchSchema), (req, res) => {
  try {
    // Credentials must never be accepted from API clients
    const { smtpPassword, ...safeUpdates } = req.validated;
    store.settings = { ...store.settings, ...safeUpdates };
    const { smtpPassword: _, ...safeSettings } = store.settings;
    res.json(safeSettings);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update settings');
  }
});

// ─── AI Reply Suggestion ──────────────────────────────────────────────────────
const ReplySuggestionSchema = z.object({
  threadSubject: z.string().max(500).trim().optional(),
  lastMessage: z.string().min(1).max(5000),
  senderName: z.string().max(200).trim().optional(),
  companyName: z.string().max(200).trim().optional(),
});

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
const MeetingSchema = z.object({
  meetingType: z.enum(['seller_discovery', 'seller_followup', 'board_intro', 'banker_intro', 'attorney_intro', 'cpa_intro', 'capital_intro', 'diligence_review', 'post_acquisition_transition', 'internal_planning']),
  title: z.string().min(1).max(500).trim(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480),
  locationType: z.enum(['phone', 'google_meet', 'zoom', 'in_person', 'other']).optional(),
  locationValue: z.string().max(1000).trim().optional(),
  linkedCompanyId: z.string().uuid().optional().or(z.literal('')),
  linkedDealId: z.string().uuid().optional().or(z.literal('')),
  linkedContactIds: z.array(z.string().uuid()).optional(),
  agenda: z.string().max(10000).optional(),
  meetingNotes: z.string().max(10000).optional(),
  status: z.enum(['draft', 'proposed', 'awaiting_confirmation', 'confirmed', 'scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show']).optional(),
});

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

const MEETING_STATUS_TRANSITIONS = {
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
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`DEH backend running on port ${PORT} [${NODE_ENV}]`);
  });
}

export { app };
