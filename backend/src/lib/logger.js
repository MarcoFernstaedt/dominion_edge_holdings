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

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

const logger = pino({
  level:    process.env.LOG_LEVEL || 'info',
  base:     { service: 'deh-backend' },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname,service' },
    },
  }),
});

export default logger;
