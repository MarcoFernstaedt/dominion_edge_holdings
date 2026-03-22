/**
 * admin.controller.js
 *
 * Minimal operational visibility for the single operator.
 * All routes are protected by requireAuth (applied globally to /api/*).
 */
import BackgroundJobRunner from '../../services/BackgroundJobRunner.js';
import IntegrationRegistry  from '../../services/IntegrationRegistry.js';

/** GET /api/admin/jobs — full job status including recent run history */
export function listJobs(_req, res) {
  res.json({ jobs: BackgroundJobRunner.status() });
}

/** POST /api/admin/jobs/:id/trigger — manually run a job */
export async function triggerJob(req, res) {
  const { id } = req.params;
  const jobs = BackgroundJobRunner.status();
  if (!jobs.find((j) => j.id === id)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Job '${id}' not found` } });
  }
  // Trigger async — return immediately
  BackgroundJobRunner.trigger(id).catch(() => {});
  res.json({ ok: true, jobId: id, message: 'Job triggered' });
}

/** PATCH /api/admin/jobs/:id — enable or disable a job */
export function setJobEnabled(req, res) {
  const { id }      = req.params;
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '`enabled` must be a boolean' } });
  }
  const jobs = BackgroundJobRunner.status();
  if (!jobs.find((j) => j.id === id)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Job '${id}' not found` } });
  }
  BackgroundJobRunner.setEnabled(id, enabled);
  res.json({ ok: true, jobId: id, enabled });
}

/** GET /api/admin/jobs/failures — global failed-run ring buffer */
export function listFailedRuns(_req, res) {
  res.json({ failures: BackgroundJobRunner.failedRuns() });
}

/** GET /api/admin/integrations — integration registry summary */
export function listIntegrations(_req, res) {
  const summary = IntegrationRegistry.getAll?.() ?? IntegrationRegistry.summary?.() ?? {};
  res.json({ integrations: summary });
}

/** GET /api/admin/integrations/health — cached integration health from last HealthCheckJob run */
export function integrationHealth(req, res) {
  const store  = req.app.locals.store;
  const cached = store?._integrationHealth;
  if (!cached) {
    return res.json({ ok: null, message: 'Health check not yet run', checkedAt: null });
  }
  res.json(cached);
}
