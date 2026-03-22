import repo                    from '../../db/repo.js';
import { nowIso }              from '../lib/helpers.js';
import BackgroundJobRunner     from '../../services/BackgroundJobRunner.js';
import IntegrationHealthService from '../../services/IntegrationHealthService.js';

const NODE_ENV = process.env.NODE_ENV || 'development';

/** Lightweight liveness probe — is the process up? */
export async function liveness(_req, res) {
  res.status(200).json({ status: 'ok', ts: nowIso() });
}

/** Readiness probe — is the process ready to serve traffic? */
export async function readiness(_req, res) {
  const checks = { db: 'unknown' };
  let overallOk = true;
  try {
    await repo.healthPing();
    checks.db = 'ok';
  } catch {
    checks.db  = 'degraded';
    overallOk  = false;
  }
  res.status(overallOk ? 200 : 503).json({ status: overallOk ? 'ok' : 'degraded', ts: nowIso(), checks });
}

/** Full health payload — db + jobs + integration health summary (public-safe, no secrets). */
export async function healthCheck(_req, res) {
  const checks  = { db: 'unknown' };
  let overallOk = true;

  // ── DB ──────────────────────────────────────────────────────────────────
  try {
    await repo.healthPing();
    checks.db = 'ok';
  } catch {
    checks.db = 'degraded';
    overallOk = false;
  }

  // ── Jobs ────────────────────────────────────────────────────────────────
  const jobStatuses    = BackgroundJobRunner.status();
  const recentFailures = BackgroundJobRunner.failedRuns().slice(-5);
  checks.jobs = jobStatuses.length > 0 ? 'ok' : 'idle';

  // ── Integration health (from last HealthCheckJob run — non-blocking) ───
  const integrationCache = IntegrationHealthService.getLastHealthResult();
  let integrationSummary = null;
  if (integrationCache) {
    const results    = integrationCache.results || [];
    const connected  = results.filter((r) => r.reachable !== false).length;
    const degraded   = results.filter((r) => r.reachable === false).length;
    checks.integrations  = degraded > 0 ? 'degraded' : 'ok';
    integrationSummary   = { connected, degraded, checkedAt: integrationCache.checkedAt };
  } else {
    checks.integrations = 'unknown';
  }

  res.status(overallOk ? 200 : 503).json({
    status: overallOk ? 'ok' : 'degraded',
    ts:     nowIso(),
    env:    NODE_ENV,
    checks,
    jobs: {
      registered:     jobStatuses.length,
      running:        jobStatuses.filter((j) => j.running).length,
      recentFailures: recentFailures.length,
    },
    integrations: integrationSummary,
  });
}
