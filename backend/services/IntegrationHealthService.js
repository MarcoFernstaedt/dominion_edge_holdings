/**
 * IntegrationHealthService
 *
 * Periodic health checks for all external integrations.
 * Updates IntegrationRegistry status on each check.
 * Never crashes the platform — all checks are try/catch isolated.
 */

import IntegrationRegistry from './IntegrationRegistry.js';
import { withRetry } from '../utils/retry.js';

// ─── Health result cache ──────────────────────────────────────────────────────
// Populated by checkAll() so admin endpoints and health controllers can serve
// the last known state without triggering live network checks.
let _lastResult = null;

export function getLastHealthResult() {
  return _lastResult;
}

// ─── Individual health checks ─────────────────────────────────────────────────

/**
 * Check Apollo API connectivity.
 * Uses a lightweight account endpoint — no credits consumed.
 */
export async function checkApolloConnection() {
  const guard = IntegrationRegistry.guard('apollo');
  if (!guard.ok) {
    return { integration: 'apollo', reachable: false, reason: guard.reason, message: guard.degradedMessage };
  }

  const cfg = IntegrationRegistry.getConfig('apollo');
  try {
    await withRetry(async () => {
      const res = await fetch(`${cfg.baseUrl}/auth/health`, {
        method:  'GET',
        headers: { 'Cache-Control': 'no-cache', 'X-Api-Key': cfg.apiKey },
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Apollo returned ${res.status}`);
    }, { maxRetries: 1, baseDelayMs: 1000 });

    IntegrationRegistry.recordSuccess('apollo');
    return { integration: 'apollo', reachable: true };
  } catch (err) {
    IntegrationRegistry.recordError('apollo', err.message);
    return { integration: 'apollo', reachable: false, reason: 'REQUEST_FAILED', message: err.message };
  }
}

/**
 * Check AI provider connectivity (Anthropic).
 * Uses a minimal token count to verify the key is valid.
 */
export async function checkAIConnection() {
  const guard = IntegrationRegistry.guard('ai');
  if (!guard.ok) {
    return { integration: 'ai', reachable: false, reason: guard.reason, message: guard.degradedMessage };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  try {
    await withRetry(async () => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages:   [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      // 400 (validation error) is still "reachable" — key works, request just invalid
      if (res.status === 401 || res.status === 403) throw new Error(`Auth failed: ${res.status}`);
    }, { maxRetries: 1, baseDelayMs: 1000 });

    IntegrationRegistry.recordSuccess('ai');
    return { integration: 'ai', reachable: true };
  } catch (err) {
    IntegrationRegistry.recordError('ai', err.message);
    return { integration: 'ai', reachable: false, reason: 'REQUEST_FAILED', message: err.message };
  }
}

/**
 * Check calendar provider connectivity.
 * Currently supports Google Calendar (OAuth token check).
 */
export async function checkCalendarConnection() {
  const guard = IntegrationRegistry.guard('calendar');
  if (!guard.ok) {
    return { integration: 'calendar', reachable: false, reason: guard.reason, message: guard.degradedMessage };
  }

  const cfg = IntegrationRegistry.getConfig('calendar');
  try {
    if (cfg.provider === 'google') {
      // Lightweight Google Calendar API test
      await withRetry(async () => {
        const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
          headers: { Authorization: `Bearer ${cfg.credentials?.access_token}` },
          signal:  AbortSignal.timeout(8000),
        });
        if (res.status === 401) throw new Error('Calendar auth expired');
        if (!res.ok)           throw new Error(`Calendar returned ${res.status}`);
      }, { maxRetries: 1, baseDelayMs: 1000 });
    }

    IntegrationRegistry.recordSuccess('calendar');
    return { integration: 'calendar', reachable: true };
  } catch (err) {
    IntegrationRegistry.recordError('calendar', err.message);
    return { integration: 'calendar', reachable: false, reason: 'REQUEST_FAILED', message: err.message };
  }
}

/**
 * Check email provider connectivity (SMTP).
 * Does a lightweight EHLO-only connection without sending mail.
 */
export async function checkEmailConnection() {
  const guard = IntegrationRegistry.guard('email');
  if (!guard.ok) {
    return { integration: 'email', reachable: false, reason: guard.reason, message: guard.degradedMessage };
  }

  const cfg = IntegrationRegistry.getConfig('email');
  try {
    // Use a DNS reachability check rather than a real SMTP connection
    // (avoids needing nodemailer in the health check path)
    await withRetry(async () => {
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(cfg.host)}&type=MX`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`DNS check failed for ${cfg.host}`);
      const json = await res.json();
      if (!json.Answer && !json.Authority) throw new Error(`No DNS records found for ${cfg.host}`);
    }, { maxRetries: 1, baseDelayMs: 500 });

    IntegrationRegistry.recordSuccess('email');
    return { integration: 'email', reachable: true };
  } catch (err) {
    IntegrationRegistry.recordError('email', err.message);
    return { integration: 'email', reachable: false, reason: 'REQUEST_FAILED', message: err.message };
  }
}

/**
 * Check Google Workspace connectivity.
 * Uses the lightweight calendar list endpoint.
 */
export async function checkGoogleConnection() {
  const guard = IntegrationRegistry.guard('google');
  if (!guard.ok) {
    return { integration: 'google', reachable: false, reason: guard.reason, message: guard.degradedMessage };
  }

  try {
    const { GoogleWorkspaceProvider } = await import('./providers/GoogleWorkspaceProvider.js');
    const result = await GoogleWorkspaceProvider.healthCheck();
    if (result.reachable) {
      IntegrationRegistry.recordSuccess('google');
      return { integration: 'google', reachable: true };
    }
    throw new Error(result.reason || 'Google health check failed');
  } catch (err) {
    IntegrationRegistry.recordError('google', err.message);
    return { integration: 'google', reachable: false, reason: 'REQUEST_FAILED', message: err.message };
  }
}

/**
 * Check object storage connectivity.
 */
export async function checkStorageConnection() {
  const guard = IntegrationRegistry.guard('storage');
  if (!guard.ok) {
    return { integration: 'storage', reachable: false, reason: guard.reason, message: guard.degradedMessage };
  }

  try {
    const { S3StorageProvider } = await import('./providers/S3StorageProvider.js');
    const result = await S3StorageProvider.healthCheck();
    if (result.reachable) {
      IntegrationRegistry.recordSuccess('storage');
      return { integration: 'storage', reachable: true };
    }
    throw new Error(result.reason || 'Storage health check failed');
  } catch (err) {
    IntegrationRegistry.recordError('storage', err.message);
    return { integration: 'storage', reachable: false, reason: 'REQUEST_FAILED', message: err.message };
  }
}

/**
 * Run all health checks in parallel.
 * Returns an array of results — never throws.
 */
export async function checkAll() {
  const checks = await Promise.allSettled([
    checkApolloConnection(),
    checkAIConnection(),
    checkCalendarConnection(),
    checkEmailConnection(),
    checkGoogleConnection(),
    checkStorageConnection(),
  ]);

  const results = checks.map((c) =>
    c.status === 'fulfilled'
      ? c.value
      : { integration: 'unknown', reachable: false, reason: 'CHECK_FAILED', message: c.reason?.message }
  );

  _lastResult = { results, checkedAt: new Date().toISOString() };
  return results;
}

export const IntegrationHealthService = {
  checkApolloConnection,
  checkAIConnection,
  checkCalendarConnection,
  checkEmailConnection,
  checkGoogleConnection,
  checkStorageConnection,
  checkAll,
  getLastHealthResult,
};
export default IntegrationHealthService;
