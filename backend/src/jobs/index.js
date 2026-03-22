/**
 * src/jobs/index.js — Background job registration and startup.
 *
 * All jobs are registered with BackgroundJobRunner here.
 * This module is imported once during app boot.
 * No job logic should be inline in app.js or server.js.
 */
import logger               from '../lib/logger.js';
import BackgroundJobRunner  from '../../services/BackgroundJobRunner.js';
import DealFeedIngestionJob   from '../../jobs/DealFeedIngestionJob.js';
import RelationshipFollowUpJob from '../../jobs/RelationshipFollowUpJob.js';
import SourcingRadarJob       from './SourcingRadarJob.js';
import HealthCheckJob         from './HealthCheckJob.js';
import PrepPacketJob          from './PrepPacketJob.js';
import PlaybookSyncJob        from './PlaybookSyncJob.js';

let _started = false;

/**
 * Register and start all background jobs.
 * Safe to call multiple times — only starts once.
 *
 * @param {object} store        In-memory store reference
 * @param {object} orchestrator Agent orchestrator
 */
export function startJobs(store, orchestrator = null) {
  if (_started) return;
  _started = true;

  // Initialize the runner (registers built-in jobs)
  BackgroundJobRunner.init(store, orchestrator);

  // Register additional domain-specific jobs
  const domainJobs = [
    DealFeedIngestionJob,
    RelationshipFollowUpJob,
    SourcingRadarJob,
    HealthCheckJob,
    PrepPacketJob,
    PlaybookSyncJob,
  ];

  for (const job of domainJobs) {
    try {
      BackgroundJobRunner.register({
        id:         job.id,
        name:       job.name,
        intervalMs: job.intervalMs,
        fn:         (ctx) => job.run(ctx),
      });
    } catch (err) {
      logger.error({ jobId: job.id, err }, `[jobs] Failed to register job: ${job.name}`);
    }
  }

  logger.info({ jobCount: BackgroundJobRunner.status().length }, '[jobs] Background jobs registered');
}

/**
 * Graceful shutdown — delegates to BackgroundJobRunner.
 * @param {number} [timeoutMs=10000]
 */
export async function stopJobs(timeoutMs = 10_000) {
  await BackgroundJobRunner.shutdown(timeoutMs);
  _started = false;
}

export { BackgroundJobRunner };
