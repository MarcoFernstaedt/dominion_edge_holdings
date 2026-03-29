/**
 * logger.js — Shared structured logger for non-HTTP code.
 *
 * HTTP request logging is handled inline in app.js (request lifecycle).
 * Everything else (services, jobs, startup, background workers) uses this.
 *
 * Usage:
 *   import logger from '../lib/logger.js';
 *   logger.info({ jobId: 'xyz', durationMs: 120 }, 'Job completed');
 *   logger.error({ err, jobId: 'xyz' }, 'Job failed');
 */

import pino from 'pino';
import env from '../config/env.js';

const logger = pino({
  level: env.LOG_LEVEL || 'info',
  base: { service: 'deh-backend', env: env.NODE_ENV },
  ...(env.isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname,service,env' },
    },
  }),
});

export default logger;
