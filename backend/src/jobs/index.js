/**
 * jobs/index.js — Background job registration and startup.
 *
 * All jobs are registered here. This module is imported once during app boot.
 * No job logic should be inline in app.js or server.js.
 */
import DealFeedIngestionJob   from '../../jobs/DealFeedIngestionJob.js';
import RelationshipFollowUpJob from '../../jobs/RelationshipFollowUpJob.js';
import BackgroundJobRunner     from '../../services/BackgroundJobRunner.js';

let _started = false;

/**
 * Register and start all background jobs.
 * Safe to call multiple times — only starts once.
 *
 * @param {object} store   In-memory store reference
 * @param {object} ctx     Service context { notificationService, taskService, ... }
 */
export function startJobs(store, ctx = {}) {
  if (_started) return;
  _started = true;

  try {
    DealFeedIngestionJob.start(store);
  } catch (err) {
    console.error('[jobs] DealFeedIngestionJob failed to start:', err.message);
  }

  try {
    RelationshipFollowUpJob.start(store, ctx);
  } catch (err) {
    console.error('[jobs] RelationshipFollowUpJob failed to start:', err.message);
  }

  console.log('[jobs] Background jobs started');
}

/**
 * Stop all registered jobs cleanly (for graceful shutdown).
 */
export function stopJobs() {
  try {
    if (typeof DealFeedIngestionJob.stop === 'function')   DealFeedIngestionJob.stop();
    if (typeof RelationshipFollowUpJob.stop === 'function') RelationshipFollowUpJob.stop();
  } catch (err) {
    console.error('[jobs] Error stopping jobs:', err.message);
  }
  _started = false;
}

export { BackgroundJobRunner };
