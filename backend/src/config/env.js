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

  // Integrations — Apollo
  APOLLO_API_KEY:      optional('APOLLO_API_KEY'),

  // Integrations — SMTP
  SMTP_HOST:           optional('SMTP_HOST'),
  SMTP_PORT:           parseInt(optional('SMTP_PORT', '587'), 10),
  SMTP_USER:           optional('SMTP_USER'),
  SMTP_PASS:           optional('SMTP_PASS'),

  // Integrations — Google Workspace (OAuth2)
  GOOGLE_CLIENT_ID:     optional('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: optional('GOOGLE_CLIENT_SECRET'),
  GOOGLE_REFRESH_TOKEN: optional('GOOGLE_REFRESH_TOKEN'),
  GOOGLE_REDIRECT_URI:  optional('GOOGLE_REDIRECT_URI', 'http://localhost:3001/api/auth/google/callback'),
  GOOGLE_CALENDAR_ID:   optional('GOOGLE_CALENDAR_ID', 'primary'),
  GMAIL_FROM_EMAIL:     optional('GMAIL_FROM_EMAIL'),
  GMAIL_FROM_NAME:      optional('GMAIL_FROM_NAME', 'Dominion Edge'),

  // Integrations — Object Storage (S3-compatible)
  AWS_ACCESS_KEY_ID:     optional('AWS_ACCESS_KEY_ID'),
  AWS_SECRET_ACCESS_KEY: optional('AWS_SECRET_ACCESS_KEY'),
  S3_BUCKET:             optional('S3_BUCKET', 'dominion-edge'),
  S3_REGION:             optional('S3_REGION', 'us-east-1'),
  S3_ENDPOINT:           optional('S3_ENDPOINT'),  // for S3-compatible providers (MinIO, Cloudflare R2, etc.)
  S3_FORCE_PATH_STYLE:   optional('S3_FORCE_PATH_STYLE', 'false') === 'true',

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
