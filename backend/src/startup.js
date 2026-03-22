/**
 * src/startup.js — Process-level safety nets and graceful shutdown.
 *
 * Import this once from the server entry point (NOT from tests).
 * Registers:
 *   - uncaughtException handler  (log + graceful exit)
 *   - unhandledRejection handler (log, no crash in prod)
 *   - SIGTERM / SIGINT handlers  (graceful HTTP server + job shutdown)
 */

import logger from './lib/logger.js';
import { stopJobs } from './jobs/index.js';

/**
 * Attach process-level error handlers.
 * @param {import('http').Server} server  The HTTP server returned by app.listen()
 */
export function registerProcessHandlers(server) {
  // ── Unhandled promise rejections ────────────────────────────────────────────
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, '[process] Unhandled promise rejection');
    // Do not exit — let the request complete; alert on-call via logs
  });

  // ── Uncaught synchronous exceptions ─────────────────────────────────────────
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, '[process] Uncaught exception — initiating shutdown');
    _shutdown(server, 1);
  });

  // ── Graceful shutdown signals ────────────────────────────────────────────────
  const onSignal = (signal) => {
    logger.info({ signal }, '[process] Received shutdown signal');
    _shutdown(server, 0);
  };

  process.once('SIGTERM', () => onSignal('SIGTERM'));
  process.once('SIGINT',  () => onSignal('SIGINT'));
}

async function _shutdown(server, exitCode) {
  try {
    // 1. Stop accepting new connections
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    // 2. Drain background jobs (10 s timeout)
    await stopJobs(10_000);

    logger.info('[process] Clean shutdown complete');
  } catch (err) {
    logger.error({ err }, '[process] Error during shutdown');
  } finally {
    process.exit(exitCode);
  }
}
