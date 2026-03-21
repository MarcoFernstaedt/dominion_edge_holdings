/**
 * env.js — Single source of truth for all environment variables.
 * Centralises validation and exposes typed config to the rest of the app.
 * Import this instead of reading process.env directly anywhere else.
 */
import dotenv from 'dotenv';
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd   = NODE_ENV === 'production';
const isTest   = NODE_ENV === 'test';

// ─── Required in production ───────────────────────────────────────────────────
function required(key) {
  if (!process.env[key] && isProd && !isTest) {
    console.error(`[env] FATAL: ${key} is required in production but not set`);
    process.exit(1);
  }
  return process.env[key] ?? null;
}

function optional(key, fallback = null) {
  return process.env[key] ?? fallback;
}

const env = {
  NODE_ENV,
  isProd,
  isTest,
  isDev: !isProd && !isTest,

  // Server
  PORT: parseInt(optional('PORT', '3001'), 10),
  LOG_LEVEL: optional('LOG_LEVEL', 'info'),

  // Database
  DATABASE_URL: required('DATABASE_URL'),

  // AI
  ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),

  // Auth
  AUTH_SECRET:         optional('AUTH_SECRET', null),
  AUTH_ENABLED:        optional('AUTH_ENABLED', 'false') === 'true',
  SINGLE_USER_TOKEN:   optional('SINGLE_USER_TOKEN', null),

  // CORS
  ALLOWED_ORIGINS: optional('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim()),

  // Integrations
  APOLLO_API_KEY:      optional('APOLLO_API_KEY'),
  SMTP_HOST:           optional('SMTP_HOST'),
  SMTP_PORT:           parseInt(optional('SMTP_PORT', '587'), 10),
  SMTP_USER:           optional('SMTP_USER'),
  SMTP_PASS:           optional('SMTP_PASS'),
  GOOGLE_CLIENT_ID:    optional('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: optional('GOOGLE_CLIENT_SECRET'),

  // System user
  SYSTEM_USER_ID:      optional('SYSTEM_USER_ID'),
};

// In production, warn about any optional-but-important vars that are missing
if (isProd) {
  const recommended = ['AUTH_SECRET', 'SINGLE_USER_TOKEN', 'SYSTEM_USER_ID'];
  for (const k of recommended) {
    if (!process.env[k]) {
      console.warn(`[env] WARNING: ${k} is not set — some features may be degraded`);
    }
  }
}

export default env;
