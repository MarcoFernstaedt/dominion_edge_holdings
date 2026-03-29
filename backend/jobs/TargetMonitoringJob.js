/**
 * TargetMonitoringJob
 *
 * Scheduled background job for continuous target intelligence (QLA step 6).
 * Runs all due entity checks, logs results, and degrades gracefully on failure.
 *
 * Interval: 4 hours (entities decide their own check frequency via checkIntervalMs).
 */

import { runDueChecks } from '../services/MonitoringEngine.js';
import AuditLogService from '../services/AuditLogService.js';
import { withRetry }   from '../utils/retry.js';
import pino            from 'pino';

const logger = pino({ name: 'TargetMonitoringJob' });

const TargetMonitoringJob = {
  id:         'targetMonitoring',
  name:       'Target Monitoring',
  intervalMs: 4 * 60 * 60 * 1000, // every 4 hours

  /**
   * @param {{ store: object }} ctx
   */
  async run({ store: _store }) {
    logger.info('[TargetMonitoringJob] starting run');

    let result;
    try {
      result = await withRetry(
        () => runDueChecks(),
        {
          maxRetries:  2,
          baseDelayMs: 2000,
          maxDelayMs:  10_000,
          onRetry: (attempt, err) => {
            logger.warn({ attempt, err: err.message }, '[TargetMonitoringJob] retry');
          },
        }
      );
    } catch (err) {
      // Degraded behavior: log and return; do not throw so BackgroundJobRunner keeps running
      logger.error({ err }, '[TargetMonitoringJob] all retries exhausted — degraded');
      AuditLogService.log('target_monitoring_job_failed', 'system', 'TargetMonitoringJob', {
        error: String(err.message),
      });
      return { degraded: true, error: err.message };
    }

    const { checked, totalCreated, totalErrors } = result;
    logger.info({ checked, totalCreated, totalErrors }, '[TargetMonitoringJob] complete');

    AuditLogService.log('target_monitoring_job_ran', 'system', 'TargetMonitoringJob', {
      checked,
      totalCreated,
      totalErrors,
    });

    return result;
  },
};

export default TargetMonitoringJob;
