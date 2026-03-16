/**
 * AutomationRuleEngine
 *
 * Event-driven rule engine: trigger → condition → action.
 * Rules are evaluated deterministically. Actions may invoke agents via AgentOrchestrator.
 *
 * Built-in triggers:
 *   email_received, meeting_completed, meeting_confirmed, meeting_scheduled,
 *   deal_stage_changed, task_overdue, contact_replied, daily_tick
 *
 * Rule shape:
 *   { id, trigger, condition(ctx) → boolean, action(ctx, services) → void, enabled }
 */

// ─── Built-in rules ───────────────────────────────────────────────────────────
const BUILT_IN_RULES = [
  {
    id: 'classify_inbound_reply',
    description: 'When email received and contact not suppressed → run ResponseAnalysisAgent',
    trigger: 'email_received',
    condition: (ctx) => ctx.contact?.status !== 'suppressed' && ctx.contact?.status !== 'unsubscribed',
    action: async (ctx, { orchestrator }) => {
      return orchestrator.run('ResponseAnalysisAgent', {
        emailBody:   ctx.email.body,
        senderName:  ctx.contact?.firstName,
        senderEmail: ctx.email.from,
        companyName: ctx.company?.name,
        entityId:    ctx.email.id,
        costFlags:   ctx.settings,
      });
    },
    enabled: true,
  },

  {
    id: 'schedule_meeting_after_interest',
    description: 'When reply classified as interested → propose meeting slots',
    trigger: 'reply_classified',
    condition: (ctx) => ctx.classification === 'interested',
    action: async (ctx, { orchestrator }) => {
      return orchestrator.run('CalendarSchedulingAgent', {
        meetingType: 'seller_discovery',
        contactName: ctx.contact?.firstName,
        entityId:    ctx.contact?.id,
        costFlags:   ctx.settings,
      });
    },
    enabled: true,
  },

  {
    id: 'create_followup_after_meeting',
    description: 'When meeting completed → create follow-up task (deterministic)',
    trigger: 'meeting_completed',
    condition: () => true,
    action: (ctx, { taskService, store, uid, nowIso }) => {
      const task = taskService.createFollowUpTask({
        meetingType:  ctx.meeting.meetingType,
        meetingTitle: ctx.meeting.title,
        meetingId:    ctx.meeting.id,
        endsAt:       ctx.meeting.endsAt,
        companyId:    ctx.meeting.linkedCompanyId,
      });
      store.tasks.push({ id: uid(), createdAt: nowIso(), ...task });
      return { created: true, taskTitle: task.title };
    },
    enabled: true,
  },

  {
    id: 'create_prep_before_meeting',
    description: 'When meeting confirmed → create prep task (deterministic)',
    trigger: 'meeting_confirmed',
    condition: () => true,
    action: (ctx, { taskService, store, uid, nowIso }) => {
      const task = taskService.createPrepTask({
        meetingType:  ctx.meeting.meetingType,
        meetingTitle: ctx.meeting.title,
        meetingId:    ctx.meeting.id,
        startsAt:     ctx.meeting.startsAt,
        companyId:    ctx.meeting.linkedCompanyId,
      });
      store.tasks.push({ id: uid(), createdAt: nowIso(), ...task });
      return { created: true, taskTitle: task.title };
    },
    enabled: true,
  },

  {
    id: 'notify_stalled_deal',
    description: 'When deal stalled (14+ days no activity) → create notification',
    trigger: 'deal_stalled',
    condition: (ctx) => ctx.daysSince >= 14,
    action: (ctx, { notificationService, store }) => {
      const n = notificationService.dealStalledNotification(ctx.deal, ctx.daysSince);
      store.notifications = [n, ...(store.notifications || [])].slice(0, 50);
      return { notified: true };
    },
    enabled: true,
  },

  {
    id: 'meeting_reminder',
    description: 'When meeting starts in ≤ 60 minutes → send reminder notification',
    trigger: 'daily_tick',
    condition: (ctx) => {
      return (ctx.upcomingMeetings || []).some((m) => {
        const minsUntil = (new Date(m.startsAt) - Date.now()) / 60000;
        return minsUntil > 0 && minsUntil <= 60;
      });
    },
    action: (ctx, { notificationService, store }) => {
      const soon = (ctx.upcomingMeetings || []).filter((m) => {
        const minsUntil = (new Date(m.startsAt) - Date.now()) / 60000;
        return minsUntil > 0 && minsUntil <= 60;
      });
      for (const m of soon) {
        const n = notificationService.meetingReminderNotification(m);
        store.notifications = [n, ...(store.notifications || [])].slice(0, 50);
      }
      return { reminders: soon.length };
    },
    enabled: true,
  },
];

// ─── Rule registry ────────────────────────────────────────────────────────────
class AutomationRuleEngineClass {
  constructor() {
    this._rules = [...BUILT_IN_RULES];
  }

  /** Register a custom rule (idempotent by id). */
  register(rule) {
    const idx = this._rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this._rules[idx] = rule;
    } else {
      this._rules.push(rule);
    }
  }

  /** Enable / disable a rule by id. */
  setEnabled(ruleId, enabled) {
    const rule = this._rules.find((r) => r.id === ruleId);
    if (rule) rule.enabled = enabled;
  }

  listRules() {
    return this._rules.map(({ id, description, trigger, enabled }) => ({ id, description, trigger, enabled }));
  }

  /**
   * Fire all matching rules for a trigger.
   *
   * @param {string} trigger  The event trigger name
   * @param {object} ctx      Event context
   * @param {object} services Injected services: { orchestrator, taskService, notificationService, store, uid, nowIso }
   * @returns {Promise<Array>} Results from each fired rule
   */
  async fire(trigger, ctx, services) {
    const matching = this._rules.filter((r) => r.enabled && r.trigger === trigger);
    const results  = [];

    for (const rule of matching) {
      try {
        // Condition check is always deterministic
        if (!rule.condition(ctx)) continue;
        const result = await rule.action(ctx, services);
        results.push({ ruleId: rule.id, success: true, result });
      } catch (err) {
        results.push({ ruleId: rule.id, success: false, error: err.message });
        console.error(`[AutomationRuleEngine] Rule ${rule.id} failed:`, err.message);
      }
    }

    return results;
  }
}

export const AutomationRuleEngine = new AutomationRuleEngineClass();
export default AutomationRuleEngine;
