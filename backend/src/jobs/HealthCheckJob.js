/**
 * HealthCheckJob
 *
 * Runs all integration health checks in the background and caches
 * the results in IntegrationHealthService so dashboards can serve
 * them without blocking on live checks. Runs every 10 minutes.
 */
import logger          from '../lib/logger.js';
import AuditLogService from '../../services/AuditLogService.js';

const HealthCheckJob = {
  id:         'integrationHealthCheck',
  name:       'Integration Health Check',
  intervalMs: 10 * 60 * 1000, // every 10 minutes

  async run() {
    let results = null;
    try {
      const { checkAll } = await import('../../services/IntegrationHealthService.js');
      // checkAll() caches its own result in IntegrationHealthService._lastResult
      results = await checkAll();
      const degraded = results.filter((r) => r.reachable === false);
      logger.info(
        { total: results.length, degraded: degraded.length },
        '[HealthCheckJob] Integration health check complete'
      );
      if (degraded.length > 0) {
        logger.warn(
          { degraded: degraded.map((r) => ({ integration: r.integration, reason: r.reason })) },
          '[HealthCheckJob] Degraded integrations detected'
        );
      }
    } catch (err) {
      logger.error({ err }, '[HealthCheckJob] Health check run failed');
    }

    const ok = results ? results.every((r) => r.reachable !== false) : false;
    AuditLogService.log('health_check_job_ran', 'system', 'HealthCheckJob', { ok });
    return { ok };
  },
};

export default HealthCheckJob;
