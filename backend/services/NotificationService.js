/**
 * NotificationService — Deterministic notification logic. No AI calls.
 *
 * Handles: notification creation, meeting lifecycle alerts, deal stage alerts,
 * task overdue alerts. Writes to the in-memory store.
 */

import crypto from 'crypto';

function uid() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }

// ─── Notification types ───────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = {
  MEETING_REMINDER:     'meeting_reminder',
  MEETING_PREP_DUE:     'meeting_prep_due',
  MEETING_FOLLOWUP_DUE: 'meeting_followup_due',
  DEAL_STAGE_CHANGED:   'deal_stage_changed',
  DEAL_STALLED:         'deal_stalled',
  TASK_OVERDUE:         'task_overdue',
  CRM_STALE_CONTACT:    'crm_stale_contact',
  OUTREACH_REPLY:       'outreach_reply',
  SYSTEM:               'system',
};

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createNotification({ type, title, message, entityId, entityType, priority = 'medium' }) {
  return {
    id: uid(),
    type,
    title,
    message,
    entityId:   entityId  || null,
    entityType: entityType || null,
    priority,
    isRead: false,
    createdAt: nowIso(),
  };
}

// ─── Meeting notifications (deterministic) ────────────────────────────────────
export function meetingReminderNotification(meeting) {
  const mins = Math.round((new Date(meeting.startsAt) - Date.now()) / 60000);
  return createNotification({
    type: NOTIFICATION_TYPES.MEETING_REMINDER,
    title: `Meeting in ${mins} minutes`,
    message: `"${meeting.title}" starts at ${new Date(meeting.startsAt).toLocaleTimeString()}`,
    entityId: meeting.id,
    entityType: 'meeting',
    priority: 'high',
  });
}

export function meetingFollowupNotification(meeting) {
  return createNotification({
    type: NOTIFICATION_TYPES.MEETING_FOLLOWUP_DUE,
    title: 'Follow-up task due',
    message: `Send follow-up for "${meeting.title}"`,
    entityId: meeting.id,
    entityType: 'meeting',
    priority: 'medium',
  });
}

// ─── Deal notifications (deterministic) ───────────────────────────────────────
export function dealStageChangedNotification(deal, fromStage, toStage) {
  return createNotification({
    type: NOTIFICATION_TYPES.DEAL_STAGE_CHANGED,
    title: 'Deal stage advanced',
    message: `${deal.companyName}: ${fromStage} → ${toStage}`,
    entityId: deal.id,
    entityType: 'deal',
    priority: toStage === 'loi_accepted' || toStage === 'due_diligence' ? 'critical' : 'medium',
  });
}

export function dealStalledNotification(deal, daysSince) {
  return createNotification({
    type: NOTIFICATION_TYPES.DEAL_STALLED,
    title: 'Deal stalled',
    message: `${deal.companyName} has had no activity for ${daysSince} days`,
    entityId: deal.id,
    entityType: 'deal',
    priority: 'high',
  });
}

// ─── Task notifications (deterministic) ───────────────────────────────────────
export function taskOverdueNotification(task) {
  return createNotification({
    type: NOTIFICATION_TYPES.TASK_OVERDUE,
    title: 'Task overdue',
    message: `"${task.title}" was due ${task.daysOverdue} day(s) ago`,
    entityId: task.id,
    entityType: 'task',
    priority: task.priority === 'critical' ? 'critical' : 'high',
  });
}

export const NotificationService = {
  createNotification,
  meetingReminderNotification,
  meetingFollowupNotification,
  dealStageChangedNotification,
  dealStalledNotification,
  taskOverdueNotification,
  NOTIFICATION_TYPES,
};
export default NotificationService;
