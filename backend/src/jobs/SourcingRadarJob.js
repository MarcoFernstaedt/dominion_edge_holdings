/**
 * SourcingRadarJob
 *
 * Periodically re-scores all sourcing candidates in the store and
 * deduplicates any new arrivals. Runs every 2 hours.
 */
import AuditLogService from '../../services/AuditLogService.js';

const SourcingRadarJob = {
  id:         'sourcingRadar',
  name:       'Sourcing Radar Rescore',
  intervalMs: 2 * 60 * 60 * 1000, // every 2 hours

  /** @param {{ store: object }} ctx */
  async run({ store }) {
    const candidates = store.sourcingCandidates || [];
    if (candidates.length === 0) return { rescored: 0 };

    let rescored = 0;
    for (const c of candidates) {
      if (typeof c.score === 'number') {
        // Re-apply any simple freshness decay: reduce score by 1 per week of staleness
        const weeksSince = c.updatedAt
          ? (Date.now() - new Date(c.updatedAt).getTime()) / (7 * 24 * 60 * 60 * 1000)
          : 0;
        const decay = Math.min(Math.floor(weeksSince), 20); // cap decay at 20 pts
        const newScore = Math.max(0, c.score - decay);
        if (newScore !== c.score) {
          c.score = newScore;
          rescored++;
        }
      }
    }

    AuditLogService.log('sourcing_radar_job_ran', 'system', 'SourcingRadarJob', { total: candidates.length, rescored });
    return { total: candidates.length, rescored };
  },
};

export default SourcingRadarJob;
