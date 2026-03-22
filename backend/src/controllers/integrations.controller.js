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

export function listIntegrations(_req, res) {
  res.json({
    config: IntegrationRegistry.getAllConfig(),
    status: IntegrationRegistry.getAllStatus(),
  });
}

export function getIntegration(req, res) {
  const { name } = req.params;
  const config = IntegrationRegistry.getConfig(name);
  if (!config) return errorResponse(res, 404, 'NOT_FOUND', `Unknown integration: ${name}`);
  const status     = IntegrationRegistry.getStatus(name);
  const safeConfig = { ...config, apiKey: config.apiKey ? '***' : null, credentials: config.credentials ? '***' : null };
  res.json({ name, config: safeConfig, status });
}

export const patchIntegrationValidate = validate(IntegrationPatchSchema);
export function patchIntegration(req, res) {
  const { name } = req.params;
  const config = IntegrationRegistry.getConfig(name);
  if (!config) return errorResponse(res, 404, 'NOT_FOUND', `Unknown integration: ${name}`);

  const patch = req.validated;
  if (patch.enabled !== undefined) {
    if (name === 'apollo')   store.settings.apolloEnabled     = patch.enabled;
    if (name === 'calendar') store.settings.calendarEnabled   = patch.enabled;
    if (name === 'ai')       store.settings.aiDraftingEnabled = patch.enabled;
    if (name === 'google')   store.settings.googleEnabled     = patch.enabled;
  }
  if (patch.apolloApiKey)     store.settings.apolloApiKey     = patch.apolloApiKey;
  if (patch.calendarProvider) store.settings.calendarProvider = patch.calendarProvider;

  IntegrationRegistry.syncFromSettings(store.settings);
  AuditLogService.log(AuditLogService.AUDIT_EVENTS.SETTINGS_UPDATED, 'integration', name, { patch: Object.keys(patch) });

  res.json({ name, status: IntegrationRegistry.getStatus(name), message: `Integration "${name}" updated.` });
}

export async function testIntegration(req, res) {
  const { name } = req.params;
  const checkers = {
    apollo:   IntegrationHealthService.checkApolloConnection,
    ai:       IntegrationHealthService.checkAIConnection,
    calendar: IntegrationHealthService.checkCalendarConnection,
    email:    IntegrationHealthService.checkEmailConnection,
    google:   IntegrationHealthService.checkGoogleConnection,
    storage:  IntegrationHealthService.checkStorageConnection,
  };
  const checker = checkers[name];
  if (!checker) return errorResponse(res, 404, 'NOT_FOUND', `Unknown integration: ${name}`);

  try {
    const result = await checker();
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', `Health check failed: ${err.message}`);
  }
}

export async function checkAllHealth(req, res) {
  try {
    const results = await IntegrationHealthService.checkAll();
    res.json({ results, checkedAt: new Date().toISOString() });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Health checks failed');
  }
}

// ─── Velocity Intelligence ────────────────────────────────────────────────────

export const getVelocity = asyncRoute(async (req, res) => {
  const userId = await repo.getSystemUserId();
  const metrics = await VelocityService.computeVelocityMetrics(userId, store.deals);
  res.json(metrics);
});

export const getVelocityTrend = asyncRoute(async (req, res) => {
  const userId = await repo.getSystemUserId();
  const trend = await VelocityService.getWeeklyVelocityTrend(userId);
  res.json(trend ?? { message: 'Trend data requires database connection' });
});
