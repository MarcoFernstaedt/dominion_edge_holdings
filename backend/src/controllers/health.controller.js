import repo     from '../../db/repo.js';
import { nowIso } from '../lib/helpers.js';

const NODE_ENV = process.env.NODE_ENV || 'development';

async function getHealthPayload() {
  const checks = { db: 'unknown', ai: 'unchecked' };
  let overallOk = true;
  try {
    await repo.healthPing();
    checks.db = 'ok';
  } catch (err) {
    checks.db = 'degraded';
    overallOk = false;
    console.error('Health check: DB ping failed', err.message);
  }
  return { status: overallOk ? 'ok' : 'degraded', ts: nowIso(), env: NODE_ENV, checks };
}

export async function healthCheck(req, res) {
  const payload = await getHealthPayload();
  res.status(payload.status === 'ok' ? 200 : 503).json(payload);
}
