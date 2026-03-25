/**
 * src/app.js — Express application factory
 *
 * Assembles all middleware and route handlers into a single Express app.
 * Import { app } from here for testing; the thin server.js shim handles listen().
 */

import express      from 'express';
import cors         from 'cors';
import helmet       from 'helmet';
import compression  from 'compression';
import rateLimit    from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import crypto       from 'crypto';
import env          from './config/env.js';
import logger       from './lib/logger.js';

// ─── Auth ─────────────────────────────────────────────────────────────────────
import authRouter          from './routes/auth.routes.js';
import { requireAuth }     from './middleware/auth.js';

// ─── Route files ──────────────────────────────────────────────────────────────
import healthRouter        from './routes/health.routes.js';
import chatRouter          from './routes/chat.routes.js';
import dashboardRouter     from './routes/dashboard.routes.js';
import companiesRouter     from './routes/companies.routes.js';
import contactsRouter      from './routes/contacts.routes.js';
import interactionsRouter  from './routes/interactions.routes.js';
import dealsRouter         from './routes/deals.routes.js';
import underwritingRouter  from './routes/underwriting.routes.js';
import boardRouter         from './routes/board.routes.js';
import networkRouter       from './routes/network.routes.js';
import investorsRouter     from './routes/investors.routes.js';
import checklistRouter     from './routes/checklist.routes.js';
import tasksRouter         from './routes/tasks.routes.js';
import meetingsRouter      from './routes/meetings.routes.js';
import inboxRouter         from './routes/inbox.routes.js';
import documentsRouter     from './routes/documents.routes.js';
import agentsRouter        from './routes/agents.routes.js';
import approvalsRouter     from './routes/approvals.routes.js';
import timingRouter        from './routes/timing.routes.js';
import integrationsRouter  from './routes/integrations.routes.js';
import sourcingRouter      from './routes/sourcing.routes.js';
import capitalRouter       from './routes/capital.routes.js';
import executionRouter     from './routes/execution.routes.js';
import playbookRouter      from './routes/playbook.routes.js';
import dealFeedRouter      from './routes/dealFeed.routes.js';
import relationshipsRouter from './routes/relationships.routes.js';
import conversationsRouter from './routes/conversations.routes.js';
import notificationsRouter from './routes/notifications.routes.js';
import filesRouter         from './routes/files.routes.js';
import adminRouter         from './routes/admin.routes.js';
import diligenceRouter     from './routes/diligence.routes.js';
import monitoringRouter    from './routes/monitoring.routes.js';

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:              ["'self'"],
        scriptSrc:               ["'self'"],
        styleSrc:                ["'self'", "'unsafe-inline'"],
        imgSrc:                  ["'self'", 'data:'],
        connectSrc:              ["'self'"],
        fontSrc:                 ["'self'"],
        objectSrc:               ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — uses env.ALLOWED_ORIGINS (parsed in env.js, never re-read here)
const ALLOWED_ORIGINS = env.ALLOWED_ORIGINS;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    methods:        ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    true,
    maxAge:         86400,
  })
);

app.use(compression());
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '128kb' }));
app.use(cookieParser());

// Request ID + structured logging
app.use((req, res, next) => {
  req.id  = crypto.randomUUID();
  req.log = logger.child({ reqId: req.id });
  const start = Date.now();
  res.on('finish', () => {
    const ms    = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    req.log[level]({ method: req.method, url: req.url, status: res.statusCode, ms });
  });
  next();
});

// ─── Rate limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            500,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: 'Too many requests', code: 'RATE_LIMITED' },
});

const aiLimiter = rateLimit({
  windowMs:       60 * 1000,
  max:            20,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: 'AI rate limit reached. Please wait before making more AI requests.', code: 'AI_RATE_LIMITED' },
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

// ─── Routes ───────────────────────────────────────────────────────────────────
// Public routes — no auth required
app.use(healthRouter);   // GET /health
app.use(authRouter);     // POST /api/auth/login, /api/auth/setup, GET /api/auth/status

// Protected — requireAuth applied globally to all remaining /api/* routes
app.use('/api', requireAuth);

app.use(chatRouter);
app.use(dashboardRouter);
app.use(companiesRouter);
app.use(contactsRouter);
app.use(interactionsRouter);
app.use(dealsRouter);
app.use(underwritingRouter);
app.use(boardRouter);
app.use(networkRouter);
app.use(investorsRouter);
app.use(checklistRouter);
app.use(tasksRouter);
app.use(meetingsRouter);
app.use(inboxRouter);
app.use(documentsRouter);
app.use(agentsRouter);
app.use(approvalsRouter);
app.use(timingRouter);
app.use(integrationsRouter);
app.use(sourcingRouter);
app.use(capitalRouter);
app.use(executionRouter);
app.use(playbookRouter);
app.use(dealFeedRouter);
app.use(relationshipsRouter);
app.use(conversationsRouter);
app.use(notificationsRouter);
app.use(filesRouter);
app.use(adminRouter);
app.use('/api/diligence',   diligenceRouter);
app.use('/api/monitoring', monitoringRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.path}` } });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status  = err.status || err.statusCode || 500;
  const code    = err.code   || 'INTERNAL_ERROR';
  const message = process.env.NODE_ENV === 'production' ? 'An internal error occurred' : (err.message || 'Unknown error');

  if (status >= 500) {
    (req.log || logger).error({ err, reqId: req.id }, 'Unhandled error');
  }

  res.status(status).json({ error: { code, message, requestId: req.id } });
});

export { app, logger };
