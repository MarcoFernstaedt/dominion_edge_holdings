/**
 * PlaybookSyncJob
 *
 * Periodically evaluates all active deals against playbook trigger conditions
 * and advances any that have met their criteria. Runs every 3 hours.
 */
import AuditLogService from '../../services/AuditLogService.js';

const PlaybookSyncJob = {
  id:         'playbookSync',
  name:       'Playbook Trigger Sync',
  intervalMs: 3 * 60 * 60 * 1000, // every 3 hours

  /** @param {{ store: object }} ctx */
  async run({ store }) {
    const { default: PlaybookService } = await import('../../services/PlaybookService.js');
    const deals = (store.deals || []).filter((d) => d.status === 'active');

    let evaluated = 0;
    let triggered = 0;
    for (const deal of deals) {
      try {
        const result = PlaybookService.evaluateTriggers?.(deal, store);
        if (result?.triggered) triggered++;
        evaluated++;
      } catch {
        // Per-deal failures should not abort the job
      }
    }

    AuditLogService.log('playbook_sync_job_ran', 'system', 'PlaybookSyncJob', { evaluated, triggered });
    return { evaluated, triggered };
  },
};

export default PlaybookSyncJob;
