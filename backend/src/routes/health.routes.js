import express from 'express';
import repo     from '../../db/repo.js';
import { nowIso } from '../lib/helpers.js';

const router = express.Router();
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

router.get('/health', async (req, res) => {
  const payload = await getHealthPayload();
  res.status(payload.status === 'ok' ? 200 : 503).json(payload);
});

router.get('/api/health', async (req, res) => {
  const payload = await getHealthPayload();
  res.status(payload.status === 'ok' ? 200 : 503).json(payload);
});

export default router;
