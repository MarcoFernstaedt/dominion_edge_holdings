import repo             from '../../db/repo.js';
import { nowIso }       from '../lib/helpers.js';
import BackgroundJobRunner from '../../services/BackgroundJobRunner.js';

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
  } catch (err) {
    checks.db  = 'degraded';
    overallOk  = false;
  }
  res.status(overallOk ? 200 : 503).json({ status: overallOk ? 'ok' : 'degraded', ts: nowIso(), checks });
}

/** Full health payload — db + jobs summary (public-safe, no secrets). */
export async function healthCheck(_req, res) {
  const checks    = { db: 'unknown' };
  let overallOk   = true;

  try {
    await repo.healthPing();
    checks.db = 'ok';
  } catch {
    checks.db = 'degraded';
    overallOk = false;
  }

  const jobs = BackgroundJobRunner.status();
  checks.jobs = jobs.length > 0 ? 'ok' : 'idle';

  res.status(overallOk ? 200 : 503).json({
    status: overallOk ? 'ok' : 'degraded',
    ts:     nowIso(),
    env:    NODE_ENV,
    checks,
    jobs: {
      registered: jobs.length,
      running:    jobs.filter((j) => j.running).length,
    },
  });
}
