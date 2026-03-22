/**
 * src/index.js — Production server entry point.
 *
 * Import chain:
 *   src/index.js  (listen + process handlers + job scheduler)
 *   └── src/app.js  (Express factory — routes, middleware, auth)
 *       └── src/routes/*  (modular route files)
 *           └── src/controllers/*  (business logic)
 *               └── src/repositories/*  (Prisma-backed, no in-memory fallback)
 *
 * For tests: import { app } from './app.js' directly.
 *
 * Boot requirements:
 *   - DATABASE_URL  required in production (env.js exits if missing)
 *   - AUTH_JWT_SECRET  required in production (env.js exits if missing)
 *   - ANTHROPIC_API_KEY  required in production (env.js exits if missing)
 *
 * Background jobs: still reference the in-memory store for ephemeral state
 * (deal feed listings, sourcing radar). Migrating them to DB-backed storage
 * is deferred to a later batch.
 */

import http from 'http';

// env.js must be imported first — it runs required() checks and exits on
// missing production vars before any other module touches the database.
import env from './config/env.js';
import { app, logger } from './app.js';
import { startJobs }           from './jobs/index.js';
import { registerProcessHandlers } from './startup.js';
import store from './store.js';

// ── Database warning in non-production ───────────────────────────────────────
if (!process.env.DATABASE_URL && !env.isProd) {
  logger.warn(
    '[boot] DATABASE_URL is not set — HTTP routes backed by Prisma repositories ' +
    'will fail at query time. Set DATABASE_URL or use server.js (legacy in-memory path) for dev.',
  );
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const PORT   = env.PORT;
const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(
    { port: PORT, env: env.NODE_ENV, db: !!process.env.DATABASE_URL },
    '[boot] Dominion Edge Holdings API listening',
  );
});

// ── Background jobs ───────────────────────────────────────────────────────────
// Pass store for jobs that still use in-memory state (deal feed, sourcing radar).
// TODO (next batch): migrate remaining jobs to DB-backed storage and remove store dependency.
startJobs(store);

// ── Process-level signal handlers ─────────────────────────────────────────────
registerProcessHandlers(server);
