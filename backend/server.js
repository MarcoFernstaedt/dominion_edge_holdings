import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || true }));
app.use(express.json({ limit: '4mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── In-memory data store (upgrade to MongoDB Atlas later) ────────────────────
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
  settings: {
    fromName: '',
    fromEmail: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    emailMode: 'smtp_only',
    primaryModel: 'claude-sonnet-4-20250514',
    apiUrl: '',
    reducedMotion: false,
    highContrast: false,
    keyboardShortcutsEnabled: true,
    density: 'standard',
    aiDraftingEnabled: true,
    aiReplyEnabled: true,
    aiBriefingEnabled: true,
  },
};

function uid() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

// ─── Middleware ────────────────────────────────────────────────────────────────
function validate(schema) {
  return (req, res, next) => {
    for (const [field, rule] of Object.entries(schema)) {
      const val = req.body[field];
      if (rule.required && (val === undefined || val === null || val === '')) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }
    next();
  };
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: nowIso() }));

// ─── AI Chat (streaming) ──────────────────────────────────────────────────────
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

app.post('/api/chat', async (req, res) => {
  const { messages, system } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = anthropic.messages.stream({
      model: store.settings.primaryModel || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: system || DEH_SYSTEM_PROMPT,
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[/api/chat error]', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
app.get('/api/dashboard/metrics', (req, res) => {
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
});

app.get('/api/dashboard/next-actions', (req, res) => {
  const now = new Date();
  const actions = [];

  // Overdue tasks
  store.tasks
    .filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < now)
    .slice(0, 3)
    .forEach((t) => {
      actions.push({ id: `task-${t.id}`, priority: 1, label: `Overdue: ${t.title}`, href: '/tasks', type: 'task' });
    });

  // Emails needing reply
  store.emailThreads
    .filter((t) => t.needsReply)
    .slice(0, 2)
    .forEach((t) => {
      actions.push({ id: `email-${t.id}`, priority: 2, label: `Reply needed: ${t.subject}`, href: '/inbox', type: 'email' });
    });

  // Stalled deals (no update in 7+ days)
  store.deals
    .filter((d) => d.status === 'active' && (now - new Date(d.updatedAt)) > 7 * 86400000)
    .slice(0, 2)
    .forEach((d) => {
      actions.push({ id: `deal-${d.id}`, priority: 3, label: `Stalled deal: ${d.companyName}`, href: `/pipeline/${d.id}`, type: 'deal' });
    });

  // Board candidates in outreach
  const boardPipeline = store.boardCandidates.filter(
    (c) => ['identified', 'researched', 'outreach_sent'].includes(c.status)
  ).length;
  if (boardPipeline > 0) {
    actions.push({ id: 'board', priority: 4, label: `${boardPipeline} board candidates need follow-up`, href: '/board', type: 'board' });
  }

  // Checklist items due
  const nextItem = store.checklistPhases
    .flatMap((p) => (p.items || []).filter((i) => !i.isComplete))
    .find(Boolean);
  if (nextItem) {
    actions.push({ id: `checklist-${nextItem.id}`, priority: 5, label: `Next step: ${nextItem.title}`, href: '/checklist', type: 'checklist' });
  }

  res.json(actions.sort((a, b) => a.priority - b.priority));
});

app.get('/api/dashboard/briefing', async (req, res) => {
  if (!store.settings.aiBriefingEnabled) {
    return res.json({ briefing: null, reason: 'AI briefing disabled' });
  }

  const metrics = {
    overdueTasks: store.tasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length,
    activeDeals: store.deals.filter((d) => d.status === 'active').length,
    needsReply: store.emailThreads.filter((t) => t.needsReply).length,
  };

  try {
    const message = await anthropic.messages.create({
      model: store.settings.primaryModel || 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: DEH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generate a concise daily briefing for Marco (3-4 sentences max). Current metrics: ${JSON.stringify(metrics)}. Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Focus on top priorities only.`,
        },
      ],
    });
    res.json({ briefing: message.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Companies ────────────────────────────────────────────────────────────────
app.get('/api/companies', (req, res) => {
  const { status, search, industry } = req.query;
  let results = [...store.companies];
  if (status) results = results.filter((c) => c.status === status);
  if (industry) results = results.filter((c) => c.industry === industry);
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.ownerName?.toLowerCase().includes(q)
    );
  }
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(results);
});

app.post('/api/companies', validate({ name: { required: true } }), (req, res) => {
  const company = {
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'prospect',
    ...req.body,
  };
  store.companies.push(company);
  res.status(201).json(company);
});

app.get('/api/companies/:id', (req, res) => {
  const company = store.companies.find((c) => c.id === req.params.id);
  if (!company) return res.status(404).json({ error: 'Not found' });
  const interactions = store.interactions.filter((i) => i.companyId === req.params.id);
  const deals = store.deals.filter((d) => d.companyId === req.params.id);
  res.json({ ...company, interactions, deals });
});

app.patch('/api/companies/:id', (req, res) => {
  const idx = store.companies.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.companies[idx] = { ...store.companies[idx], ...req.body, updatedAt: nowIso() };
  res.json(store.companies[idx]);
});

app.delete('/api/companies/:id', (req, res) => {
  store.companies = store.companies.filter((c) => c.id !== req.params.id);
  res.status(204).end();
});

// ─── Contacts ─────────────────────────────────────────────────────────────────
app.get('/api/contacts', (req, res) => {
  const { companyId, type } = req.query;
  let results = [...store.contacts];
  if (companyId) results = results.filter((c) => c.companyId === companyId);
  if (type) results = results.filter((c) => c.type === type);
  res.json(results);
});

app.post('/api/contacts', validate({ name: { required: true } }), (req, res) => {
  const contact = { id: uid(), createdAt: nowIso(), updatedAt: nowIso(), ...req.body };
  store.contacts.push(contact);
  res.status(201).json(contact);
});

app.get('/api/contacts/:id', (req, res) => {
  const contact = store.contacts.find((c) => c.id === req.params.id);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  const interactions = store.interactions.filter((i) => i.contactId === req.params.id);
  res.json({ ...contact, interactions });
});

app.patch('/api/contacts/:id', (req, res) => {
  const idx = store.contacts.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.contacts[idx] = { ...store.contacts[idx], ...req.body, updatedAt: nowIso() };
  res.json(store.contacts[idx]);
});

app.delete('/api/contacts/:id', (req, res) => {
  store.contacts = store.contacts.filter((c) => c.id !== req.params.id);
  res.status(204).end();
});

// ─── Interactions ─────────────────────────────────────────────────────────────
app.get('/api/interactions', (req, res) => {
  const { companyId, contactId, dealId } = req.query;
  let results = [...store.interactions];
  if (companyId) results = results.filter((i) => i.companyId === companyId);
  if (contactId) results = results.filter((i) => i.contactId === contactId);
  if (dealId) results = results.filter((i) => i.dealId === dealId);
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(results);
});

app.post('/api/interactions', validate({ type: { required: true } }), (req, res) => {
  const interaction = { id: uid(), createdAt: nowIso(), ...req.body };
  store.interactions.push(interaction);

  // Update company updatedAt if linked
  if (interaction.companyId) {
    const idx = store.companies.findIndex((c) => c.id === interaction.companyId);
    if (idx !== -1) store.companies[idx].updatedAt = nowIso();
  }

  res.status(201).json(interaction);
});

// ─── Deals ────────────────────────────────────────────────────────────────────
app.get('/api/deals', (req, res) => {
  const { status, stage } = req.query;
  let results = [...store.deals];
  if (status) results = results.filter((d) => d.status === status);
  if (stage) results = results.filter((d) => d.stage === stage);
  results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(results);
});

app.post('/api/deals', validate({ companyName: { required: true } }), (req, res) => {
  const deal = {
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'active',
    stage: 'sourcing',
    ...req.body,
  };
  store.deals.push(deal);
  res.status(201).json(deal);
});

app.get('/api/deals/:id', (req, res) => {
  const deal = store.deals.find((d) => d.id === req.params.id);
  if (!deal) return res.status(404).json({ error: 'Not found' });
  const scenarios = store.underwritingScenarios.filter((s) => s.dealId === req.params.id);
  const interactions = store.interactions.filter((i) => i.dealId === req.params.id);
  const documents = store.documents.filter((d) => d.entityId === req.params.id);
  res.json({ ...deal, scenarios, interactions, documents });
});

app.patch('/api/deals/:id', (req, res) => {
  const idx = store.deals.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.deals[idx] = { ...store.deals[idx], ...req.body, updatedAt: nowIso() };
  res.json(store.deals[idx]);
});

app.delete('/api/deals/:id', (req, res) => {
  store.deals = store.deals.filter((d) => d.id !== req.params.id);
  res.status(204).end();
});

// ─── Underwriting ─────────────────────────────────────────────────────────────
function calcMonthlyPayment(principal, annualRatePct, termMonths) {
  if (principal <= 0 || annualRatePct <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = termMonths;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

app.post('/api/underwriting/calculate', (req, res) => {
  const {
    netIncome = 0,
    ownerSalary = 0,
    personalAddbacks = 0,
    oneTimeAdjustments = 0,
    marketRateManagement = 0,
    askingPrice = 0,
    downPaymentPct = 10,
    sellerNotePct = 0,
    seniorDebtRatePct = 6.5,
    seniorDebtTermMonths = 120,
    sellerNoteRatePct = 6,
    sellerNoteTermMonths = 60,
  } = req.body;

  const grossSDE = netIncome + ownerSalary + personalAddbacks + oneTimeAdjustments;
  const normalizedSDE = grossSDE - marketRateManagement;

  const downPayment = (askingPrice * downPaymentPct) / 100;
  const sellerNoteAmount = (askingPrice * sellerNotePct) / 100;
  const seniorDebtAmount = askingPrice - downPayment - sellerNoteAmount;

  const monthlyDebtService =
    calcMonthlyPayment(seniorDebtAmount, seniorDebtRatePct, seniorDebtTermMonths) +
    calcMonthlyPayment(sellerNoteAmount, sellerNoteRatePct, sellerNoteTermMonths);

  const annualDebtService = monthlyDebtService * 12;
  const dscr = annualDebtService > 0 ? normalizedSDE / annualDebtService : 0;
  const postDebtCashFlow = normalizedSDE - annualDebtService;

  const multiple = askingPrice > 0 && normalizedSDE > 0 ? askingPrice / normalizedSDE : 0;
  const sdeMarginPct = (netIncome + ownerSalary) > 0 ? (normalizedSDE / (netIncome + ownerSalary + personalAddbacks + oneTimeAdjustments)) * 100 : 0;

  const riskFlags = [];
  if (dscr > 0 && dscr < 1.25) riskFlags.push({ type: 'dscr', message: `DSCR ${dscr.toFixed(2)}x below minimum 1.25x` });
  if (multiple > 5.5) riskFlags.push({ type: 'multiple', message: `Multiple ${multiple.toFixed(1)}x above typical 3–5x range` });
  if (downPaymentPct < 10) riskFlags.push({ type: 'equity', message: 'Down payment below 10% SBA minimum' });

  res.json({
    grossSDE,
    normalizedSDE,
    downPayment,
    seniorDebtAmount,
    sellerNoteAmount,
    monthlyDebtService,
    annualDebtService,
    dscr,
    postDebtCashFlow,
    multiple,
    riskFlags,
  });
});

app.get('/api/underwriting/scenarios', (req, res) => {
  const { dealId } = req.query;
  let results = [...store.underwritingScenarios];
  if (dealId) results = results.filter((s) => s.dealId === dealId);
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(results);
});

app.post('/api/underwriting/scenarios', (req, res) => {
  const scenario = { id: uid(), createdAt: nowIso(), ...req.body };
  store.underwritingScenarios.push(scenario);
  res.status(201).json(scenario);
});

app.delete('/api/underwriting/scenarios/:id', (req, res) => {
  store.underwritingScenarios = store.underwritingScenarios.filter((s) => s.id !== req.params.id);
  res.status(204).end();
});

// ─── Board ────────────────────────────────────────────────────────────────────
app.get('/api/board/seats', (req, res) => {
  res.json(store.boardSeats);
});

app.get('/api/board/candidates', (req, res) => {
  const { seatId, status } = req.query;
  let results = [...store.boardCandidates];
  if (seatId) results = results.filter((c) => c.seatId === seatId);
  if (status) results = results.filter((c) => c.status === status);
  res.json(results);
});

app.post('/api/board/candidates', validate({ name: { required: true } }), (req, res) => {
  const candidate = { id: uid(), createdAt: nowIso(), updatedAt: nowIso(), status: 'identified', ...req.body };
  store.boardCandidates.push(candidate);
  res.status(201).json(candidate);
});

app.patch('/api/board/candidates/:id', (req, res) => {
  const idx = store.boardCandidates.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.boardCandidates[idx] = { ...store.boardCandidates[idx], ...req.body, updatedAt: nowIso() };
  res.json(store.boardCandidates[idx]);
});

app.delete('/api/board/candidates/:id', (req, res) => {
  store.boardCandidates = store.boardCandidates.filter((c) => c.id !== req.params.id);
  res.status(204).end();
});

app.get('/api/board/cap-table', (req, res) => {
  res.json(store.capTable);
});

app.post('/api/board/cap-table', (req, res) => {
  const entry = { id: uid(), createdAt: nowIso(), ...req.body };
  store.capTable.push(entry);
  res.status(201).json(entry);
});

app.delete('/api/board/cap-table/:id', (req, res) => {
  store.capTable = store.capTable.filter((e) => e.id !== req.params.id);
  res.status(204).end();
});

// ─── Checklist ────────────────────────────────────────────────────────────────
app.get('/api/checklist', (req, res) => {
  res.json(store.checklistPhases);
});

app.post('/api/checklist/phases', (req, res) => {
  const phase = { id: uid(), items: [], ...req.body };
  store.checklistPhases.push(phase);
  res.status(201).json(phase);
});

app.patch('/api/checklist/items/:itemId/complete', (req, res) => {
  const { itemId } = req.params;
  let found = false;

  for (const phase of store.checklistPhases) {
    const item = (phase.items || []).find((i) => i.id === itemId);
    if (item) {
      item.isComplete = req.body.isComplete ?? true;
      item.completedAt = item.isComplete ? nowIso() : undefined;
      found = true;
      break;
    }
  }

  if (!found) return res.status(404).json({ error: 'Item not found' });
  res.json({ ok: true });
});

// ─── Tasks ────────────────────────────────────────────────────────────────────
app.get('/api/tasks', (req, res) => {
  const { status, priority, assignedTo } = req.query;
  let results = [...store.tasks];
  if (status) results = results.filter((t) => t.status === status);
  if (priority) results = results.filter((t) => t.priority === priority);
  results.sort((a, b) => {
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  res.json(results);
});

app.post('/api/tasks', validate({ title: { required: true } }), (req, res) => {
  const task = {
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'todo',
    priority: 'medium',
    ...req.body,
  };
  store.tasks.push(task);
  res.status(201).json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const idx = store.tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const updates = { ...req.body, updatedAt: nowIso() };
  if (updates.status === 'done' && !store.tasks[idx].completedAt) {
    updates.completedAt = nowIso();
  }
  store.tasks[idx] = { ...store.tasks[idx], ...updates };
  res.json(store.tasks[idx]);
});

app.delete('/api/tasks/:id', (req, res) => {
  store.tasks = store.tasks.filter((t) => t.id !== req.params.id);
  res.status(204).end();
});

// ─── Inbox ────────────────────────────────────────────────────────────────────
app.get('/api/inbox/threads', (req, res) => {
  const { needsReply, status } = req.query;
  let results = [...store.emailThreads];
  if (needsReply === 'true') results = results.filter((t) => t.needsReply);
  if (status) results = results.filter((t) => t.status === status);
  results.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  res.json(results);
});

app.get('/api/inbox/threads/:id', (req, res) => {
  const thread = store.emailThreads.find((t) => t.id === req.params.id);
  if (!thread) return res.status(404).json({ error: 'Not found' });
  res.json(thread);
});

app.post('/api/inbox/compose', validate({ to: { required: true }, subject: { required: true } }), (req, res) => {
  // In MVP, we record the thread; actual SMTP sending requires backend credentials
  const thread = {
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'sent',
    direction: 'outbound',
    needsReply: false,
    messages: [
      {
        id: uid(),
        from: store.settings.fromEmail || 'marco@dominionedge.com',
        to: req.body.to,
        subject: req.body.subject,
        body: req.body.body || '',
        sentAt: nowIso(),
        direction: 'outbound',
      },
    ],
    ...req.body,
  };
  store.emailThreads.push(thread);

  // Record as outbound interaction if companyId provided
  if (req.body.companyId) {
    store.interactions.push({
      id: uid(),
      companyId: req.body.companyId,
      contactId: req.body.contactId,
      type: 'email',
      direction: 'outbound',
      subject: req.body.subject,
      notes: req.body.body,
      createdAt: nowIso(),
    });
  }

  res.status(201).json(thread);
});

app.patch('/api/inbox/threads/:id', (req, res) => {
  const idx = store.emailThreads.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.emailThreads[idx] = { ...store.emailThreads[idx], ...req.body, updatedAt: nowIso() };
  res.json(store.emailThreads[idx]);
});

// ─── Outreach / AI Drafting ───────────────────────────────────────────────────
app.get('/api/outreach/templates', (req, res) => {
  const { templateType } = req.query;
  let results = [...store.outreachTemplates ?? []];
  if (templateType) results = results.filter((t) => t.templateType === templateType);
  res.json(results);
});

app.post('/api/outreach/generate', async (req, res) => {
  if (!store.settings.aiDraftingEnabled) {
    return res.status(403).json({ error: 'AI drafting is disabled in settings' });
  }

  const { templateType, variables = {}, companyName, ownerName, context } = req.body;

  if (!templateType) {
    return res.status(400).json({ error: 'templateType is required' });
  }

  const typeDescriptions = {
    seller_outreach: 'initial cold outreach to a business owner exploring acquisition',
    seller_follow_up: 'warm follow-up to a seller who has not responded',
    board_outreach: 'invitation to join an acquisition advisory board',
    lender_outreach: 'introduction to a lender for SBA 7(a) financing',
    networking_outreach: 'networking message for deal sourcing',
  };

  try {
    const message = await anthropic.messages.create({
      model: store.settings.primaryModel || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: DEH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Draft a personalized ${typeDescriptions[templateType] || templateType} email.
Company: ${companyName || '[Company]'}
Owner: ${ownerName || '[Owner]'}
From: Marco Fernstaedt, Dominion Edge Holdings
Additional context: ${context || 'None'}

Return JSON: {"subject": "...", "body": "..."}
Be direct, genuine, and specific. 3-4 short paragraphs maximum.`,
        },
      ],
    });

    const text = message.content[0].text;
    try {
      const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
      res.json({ subject: json.subject || '', body: json.body || text });
    } catch {
      res.json({ subject: `Inquiry: ${companyName || 'Your Business'}`, body: text });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Documents ────────────────────────────────────────────────────────────────
app.get('/api/documents', (req, res) => {
  const { entityId, documentType } = req.query;
  let results = [...store.documents];
  if (entityId) results = results.filter((d) => d.entityId === entityId);
  if (documentType) results = results.filter((d) => d.documentType === documentType);
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(results);
});

app.post('/api/documents', validate({ title: { required: true }, content: { required: true } }), (req, res) => {
  const doc = {
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'draft',
    version: 1,
    source: 'template',
    generatedBy: 'system',
    ...req.body,
  };
  store.documents.push(doc);
  res.status(201).json(doc);
});

app.get('/api/documents/:id', (req, res) => {
  const doc = store.documents.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

app.patch('/api/documents/:id', (req, res) => {
  const idx = store.documents.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.documents[idx] = { ...store.documents[idx], ...req.body, updatedAt: nowIso() };
  res.json(store.documents[idx]);
});

app.delete('/api/documents/:id', (req, res) => {
  store.documents = store.documents.filter((d) => d.id !== req.params.id);
  res.status(204).end();
});

// ─── Reports ──────────────────────────────────────────────────────────────────
app.get('/api/reports/summary', (req, res) => {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);
  const monthAgo = new Date(now - 30 * 86400000);

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
      stalled: store.deals.filter((d) => d.status === 'active' && (now - new Date(d.updatedAt)) > 7 * 86400000).length,
    },
    board: {
      confirmed: store.boardCandidates.filter((c) => c.status === 'confirmed').length,
      pipeline: store.boardCandidates.filter((c) => ['identified', 'researched', 'outreach_sent', 'meeting_scheduled', 'interested', 'negotiating'].includes(c.status)).length,
      total: store.boardCandidates.length,
    },
    underwriting: {
      scenarios: store.underwritingScenarios.length,
      passingDSCR: store.underwritingScenarios.filter((s) => s.dscr >= 1.25).length,
      bestDSCR: store.underwritingScenarios.reduce((best, s) => Math.max(best, s.dscr || 0), 0),
    },
    documents: {
      total: store.documents.length,
    },
  });
});

app.get('/api/reports/weekly', (req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  res.json({
    period: 'last_7_days',
    from: weekAgo.toISOString(),
    to: new Date().toISOString(),
    companiesAdded: store.companies.filter((c) => new Date(c.createdAt) > weekAgo).length,
    outboundEmails: store.interactions.filter((i) => i.direction === 'outbound' && new Date(i.createdAt) > weekAgo).length,
    inboundReplies: store.interactions.filter((i) => i.direction === 'inbound' && new Date(i.createdAt) > weekAgo).length,
    tasksCompleted: store.tasks.filter((t) => t.status === 'done' && t.completedAt && new Date(t.completedAt) > weekAgo).length,
    dealsAdvanced: store.deals.filter((d) => new Date(d.updatedAt) > weekAgo).length,
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  // Never return sensitive fields
  const { smtpPassword, ...safeSettings } = store.settings;
  res.json(safeSettings);
});

app.patch('/api/settings', (req, res) => {
  // Never allow setting passwords via API
  const { smtpPassword, ...safeUpdates } = req.body;
  store.settings = { ...store.settings, ...safeUpdates };
  const { smtpPassword: _, ...safeSettings } = store.settings;
  res.json(safeSettings);
});

// ─── AI Reply Suggestions ─────────────────────────────────────────────────────
app.post('/api/ai/reply-suggestion', async (req, res) => {
  if (!store.settings.aiReplyEnabled) {
    return res.status(403).json({ error: 'AI reply suggestions disabled in settings' });
  }

  const { threadSubject, lastMessage, senderName, companyName } = req.body;
  if (!lastMessage) return res.status(400).json({ error: 'lastMessage is required' });

  try {
    const message = await anthropic.messages.create({
      model: store.settings.primaryModel || 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: DEH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Suggest a brief, professional reply to this email.
Sender: ${senderName || 'Unknown'}
Company: ${companyName || 'Unknown'}
Subject: ${threadSubject || 'No subject'}
Their message: "${lastMessage}"

Return JSON: {"subject": "Re: ...", "body": "..."}
Keep it under 100 words. Be direct and genuine.`,
        },
      ],
    });

    const text = message.content[0].text;
    try {
      const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
      res.json({ subject: json.subject || `Re: ${threadSubject}`, body: json.body || text });
    } catch {
      res.json({ subject: `Re: ${threadSubject}`, body: text });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Dominion Edge Holdings backend running on port ${PORT}`));
