import express from 'express';
import { z }  from 'zod';
import store  from '../store.js';
import IntegrationRegistry      from '../../services/IntegrationRegistry.js';
import IntegrationHealthService from '../../services/IntegrationHealthService.js';
import AuditLogService          from '../../services/AuditLogService.js';
import VelocityService          from '../../services/VelocityService.js';
import repo                     from '../../db/repo.js';
import { validate }             from '../middleware/validate.js';
import { errorResponse }        from '../middleware/errorResponse.js';
import { asyncRoute }           from '../middleware/validate.js';
import { IntegrationPatchSchema } from '../../schemas/index.js';

const router = express.Router();

router.get('/api/integrations', (_req, res) => {
  res.json({
    config: IntegrationRegistry.getAllConfig(),
    status: IntegrationRegistry.getAllStatus(),
  });
});

router.get('/api/integrations/:name', (req, res) => {
  const { name } = req.params;
  const config = IntegrationRegistry.getConfig(name);
  if (!config) return errorResponse(res, 404, 'NOT_FOUND', `Unknown integration: ${name}`);
  const status     = IntegrationRegistry.getStatus(name);
  const safeConfig = { ...config, apiKey: config.apiKey ? '***' : null, credentials: config.credentials ? '***' : null };
  res.json({ name, config: safeConfig, status });
});

router.patch('/api/integrations/:name', validate(IntegrationPatchSchema), (req, res) => {
  const { name } = req.params;
  const config = IntegrationRegistry.getConfig(name);
  if (!config) return errorResponse(res, 404, 'NOT_FOUND', `Unknown integration: ${name}`);

  const patch = req.validated;
  if (patch.enabled !== undefined) {
    if (name === 'apollo')   store.settings.apolloEnabled     = patch.enabled;
    if (name === 'calendar') store.settings.calendarEnabled   = patch.enabled;
    if (name === 'ai')       store.settings.aiDraftingEnabled = patch.enabled;
  }
  if (patch.apolloApiKey)     store.settings.apolloApiKey     = patch.apolloApiKey;
  if (patch.calendarProvider) store.settings.calendarProvider = patch.calendarProvider;

  IntegrationRegistry.syncFromSettings(store.settings);
  AuditLogService.log(AuditLogService.AUDIT_EVENTS.SETTINGS_UPDATED, 'integration', name, { patch: Object.keys(patch) });

  res.json({ name, status: IntegrationRegistry.getStatus(name), message: `Integration "${name}" updated.` });
});

router.post('/api/integrations/:name/test', async (req, res) => {
  const { name } = req.params;
  const checkers = {
    apollo:   IntegrationHealthService.checkApolloConnection,
    ai:       IntegrationHealthService.checkAIConnection,
    calendar: IntegrationHealthService.checkCalendarConnection,
    email:    IntegrationHealthService.checkEmailConnection,
  };
  const checker = checkers[name];
  if (!checker) return errorResponse(res, 404, 'NOT_FOUND', `Unknown integration: ${name}`);

  try {
    const result = await checker();
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Health check failed: ${err.message}`);
  }
});

router.post('/api/integrations/health/check-all', async (req, res) => {
  try {
    const results = await IntegrationHealthService.checkAll();
    res.json({ results, checkedAt: new Date().toISOString() });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Health checks failed');
  }
});

// ─── Velocity Intelligence ────────────────────────────────────────────────────

router.get('/api/velocity', asyncRoute(async (req, res) => {
  const userId = await repo.getSystemUserId();
  const metrics = await VelocityService.computeVelocityMetrics(userId, store.deals);
  res.json(metrics);
}));

router.get('/api/velocity/trend', asyncRoute(async (req, res) => {
  const userId = await repo.getSystemUserId();
  const trend = await VelocityService.getWeeklyVelocityTrend(userId);
  res.json(trend ?? { message: 'Trend data requires database connection' });
}));

export default router;
