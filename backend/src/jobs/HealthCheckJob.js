/**
 * HealthCheckJob
 *
 * Runs all integration health checks in the background and caches
 * the results in store._integrationHealth so dashboards can serve
 * them without blocking on live checks. Runs every 10 minutes.
 */
import AuditLogService from '../../services/AuditLogService.js';

const HealthCheckJob = {
  id:         'integrationHealthCheck',
  name:       'Integration Health Check',
  intervalMs: 10 * 60 * 1000, // every 10 minutes

  /** @param {{ store: object }} ctx */
  async run({ store }) {
    let results = null;
    try {
      const { checkAll } = await import('../../services/IntegrationHealthService.js');
      results = await checkAll();
      store._integrationHealth = { results, checkedAt: new Date().toISOString() };
    } catch (err) {
      // Non-fatal — health check failure should never crash the runner
      store._integrationHealth = {
        results:   null,
        error:     err.message,
        checkedAt: new Date().toISOString(),
      };
    }

    AuditLogService.log('health_check_job_ran', 'system', 'HealthCheckJob', {
      ok: results ? results.every((r) => r.ok) : false,
    });

    return { ok: results ? results.every((r) => r.ok) : false };
  },
};

export default HealthCheckJob;
