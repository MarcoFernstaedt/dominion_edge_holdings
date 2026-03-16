/**
 * RelationshipFollowUpJob
 *
 * Daily background job that:
 *  1. Scans all active relationships for overdue follow-up dates.
 *  2. Creates follow-up tasks in store.tasks for each overdue relationship.
 *  3. Fires notifications for high-interest / ready relationships.
 *  4. Updates Deal Momentum stats for seller relationships.
 *  5. Runs relationship status auto-calculation.
 *
 * Run interval: every 24 hours (configurable via intervalMs export).
 * Never runs inline in a request cycle.
 */

import RelationshipService from '../services/RelationshipService.js';
import AuditLogService     from '../services/AuditLogService.js';

const RelationshipFollowUpJob = {
  id:         'relationshipFollowUp',
  name:       'Relationship Follow-Up Task Generator',
  intervalMs: 24 * 60 * 60 * 1000, // every 24 hours

  /**
   * @param {{ store: object, orchestrator: object }} ctx – injected by BackgroundJobRunner
   */
  async run({ store }) {
    const uid    = () => crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // 1. Generate follow-up tasks for overdue relationships
    const tasksCreated = RelationshipService.generateFollowUpTasks(store, uid, nowIso);

    // 2. Notify for overdue high-interest relationships
    const dashboard = RelationshipService.getDashboardData();
    const urgentOverdue = [
      ...dashboard.overdueSellers,
      ...dashboard.overdueBoardMembers,
      ...dashboard.overdueInvestors,
    ].filter((r) => r.interestLevel === 'high' || r.interestLevel === 'ready');

    if (urgentOverdue.length > 0 && Array.isArray(store.notifications)) {
      store.notifications.unshift({
        id:        uid(),
        type:      'relationship',
        title:     'Relationship Follow-Ups Required',
        message:   `${urgentOverdue.length} high-priority relationship${urgentOverdue.length > 1 ? 's' : ''} overdue for follow-up.`,
        priority:  'high',
        createdAt: nowIso,
        read:      false,
      });
      // Cap notifications
      if (store.notifications.length > 100) {
        store.notifications = store.notifications.slice(0, 100);
      }
    }

    // 3. Update DealMomentum for sellers: boost score if recently contacted
    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentInteractions = (store.relationshipInteractions || [])
      .filter((i) => i.createdAt >= recentCutoff);

    // Build set of recently-contacted seller relationship IDs
    const recentSellerRelIds = new Set();
    for (const i of recentInteractions) {
      const rel = (store.relationships || []).find((r) => r.id === i.relationshipId && r.entityType === 'seller');
      if (rel) recentSellerRelIds.add(rel.id);
    }

    // For each deal that maps to a seller relationship, nudge momentumScore
    if (recentSellerRelIds.size > 0) {
      for (const stat of (store.dealMomentumStats || [])) {
        const rel = (store.relationships || []).find(
          (r) => r.entityType === 'seller' && (r.entityId === stat.dealId || r.entityId === stat.companyId)
        );
        if (rel && recentSellerRelIds.has(rel.id)) {
          stat.momentumScore  = Math.min(100, (stat.momentumScore || 50) + 5);
          stat.lastActivityAt = nowIso;
        }
      }
    }

    // 4. Auto-calculate relationship statuses
    for (const rel of (store.relationships || [])) {
      if (rel.relationshipStatus !== 'closed' && rel.relationshipStatus !== 'not_interested') {
        RelationshipService.calculateRelationshipStatus(rel.id, nowIso);
      }
    }

    AuditLogService.log('relationship.followup_job_ran', 'system', 'RelationshipFollowUpJob', {
      tasksCreated,
      urgentOverdue: urgentOverdue.length,
      overdueTotal:  dashboard.overdueTotal,
    });

    return { tasksCreated, overdueTotal: dashboard.overdueTotal };
  },
};

// Need crypto for uid() — import at module level
import crypto from 'crypto';

export default RelationshipFollowUpJob;
