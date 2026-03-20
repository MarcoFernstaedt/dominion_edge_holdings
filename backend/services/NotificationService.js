/**
 * NotificationService
 *
 * High-signal, low-noise notification system.
 *
 * Philosophy:
 *  - Notifications point toward action, not noise.
 *  - Pinned alerts persist until state improves.
 *  - Feed notifications are dismissible.
 *  - Dedupe prevents re-firing the same alert for the same entity within a window.
 *  - Every notification carries action_label + action_url where possible.
 *
 * All logic is deterministic. No AI calls.
 */

import crypto from 'crypto';

function uid()    { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }

// ─── Notification types ───────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = {
  // Approval flow
  APPROVAL_NEEDED:         'approval_needed',
  APPROVAL_STALE:          'approval_stale',

  // Task lifecycle
  TASK_DUE:                'task_due',
  TASK_OVERDUE:            'task_overdue',
  CRITICAL_OVERDUE:        'critical_overdue',

  // Relationship
  RELATIONSHIP_COOLING:    'relationship_cooling',

  // Deal
  DEAL_STALLED:            'deal_stalled',
  DEAL_CRITICAL:           'deal_critical',
  DEAL_STAGE_CHANGED:      'deal_stage_changed',

  // Board
  BOARD_SEAT_WEAK:         'board_seat_weak',
  BOARD_CANDIDATE_FOLLOWUP:'board_candidate_followup_due',

  // Meeting
  MEETING_REMINDER:        'meeting_reminder',
  MEETING_PREP_DUE:        'meeting_prep_due',
  MEETING_FOLLOWUP_DUE:    'meeting_followup_due',

  // Diligence / lender
  DILIGENCE_BLOCKER:       'diligence_blocker',
  LENDER_BLOCKER:          'lender_blocker',

  // Investor
  INVESTOR_FOLLOWUP_DUE:   'investor_followup_due',

  // System / integration
  INTEGRATION_DEGRADED:    'integration_degraded',
  SYSTEM_WARNING:          'system_warning',

  // Artifacts
  ARTIFACT_STALE:          'artifact_stale',

  // Actions
  NEXT_ACTION_CHANGED:     'next_action_changed',
  RECOVERY_NEEDED:         'recovery_needed',

  // Legacy compat
  CRM_STALE_CONTACT:       'crm_stale_contact',
  OUTREACH_REPLY:          'outreach_reply',
};

// ─── Severity values ──────────────────────────────────────────────────────────

export const SEVERITY = {
  INFO:      'info',
  WATCH:     'watch',
  IMPORTANT: 'important',
  CRITICAL:  'critical',
};

// ─── Pinned vs feed classification ───────────────────────────────────────────

// Pinned alerts stay until the underlying state improves.
const PINNED_TYPES = new Set([
  NOTIFICATION_TYPES.CRITICAL_OVERDUE,
  NOTIFICATION_TYPES.DILIGENCE_BLOCKER,
  NOTIFICATION_TYPES.LENDER_BLOCKER,
  NOTIFICATION_TYPES.BOARD_SEAT_WEAK,
  NOTIFICATION_TYPES.MEETING_PREP_DUE,
  NOTIFICATION_TYPES.APPROVAL_STALE,
  NOTIFICATION_TYPES.INTEGRATION_DEGRADED,
]);

export function isPinned(type) { return PINNED_TYPES.has(type); }

// ─── Dedupe window by type (ms) ───────────────────────────────────────────────

const DEDUPE_WINDOW_MS = {
  [NOTIFICATION_TYPES.APPROVAL_NEEDED]:          0,          // always fire
  [NOTIFICATION_TYPES.APPROVAL_STALE]:           3_600_000,  // 1h
  [NOTIFICATION_TYPES.TASK_DUE]:                 86_400_000, // 24h
  [NOTIFICATION_TYPES.TASK_OVERDUE]:             21_600_000, // 6h
  [NOTIFICATION_TYPES.CRITICAL_OVERDUE]:         3_600_000,  // 1h
  [NOTIFICATION_TYPES.RELATIONSHIP_COOLING]:     86_400_000,
  [NOTIFICATION_TYPES.DEAL_STALLED]:             86_400_000,
  [NOTIFICATION_TYPES.DEAL_CRITICAL]:            3_600_000,
  [NOTIFICATION_TYPES.BOARD_SEAT_WEAK]:          86_400_000,
  [NOTIFICATION_TYPES.BOARD_CANDIDATE_FOLLOWUP]: 86_400_000,
  [NOTIFICATION_TYPES.MEETING_REMINDER]:         0,
  [NOTIFICATION_TYPES.MEETING_PREP_DUE]:         86_400_000,
  [NOTIFICATION_TYPES.MEETING_FOLLOWUP_DUE]:     86_400_000,
  [NOTIFICATION_TYPES.INVESTOR_FOLLOWUP_DUE]:    86_400_000,
  [NOTIFICATION_TYPES.ARTIFACT_STALE]:           43_200_000, // 12h
  [NOTIFICATION_TYPES.INTEGRATION_DEGRADED]:     1_800_000,  // 30m
  default:                                       3_600_000,
};

// ─── Core factory ─────────────────────────────────────────────────────────────

/**
 * Create a notification record.
 * Does NOT push to store — caller must push to store.notifications.
 */
export function createNotification({
  type,
  title,
  body,
  message,          // legacy alias for body
  severity          = SEVERITY.WATCH,
  linked_entity_type = null,
  linked_entity_id   = null,
  entityId           = null,  // legacy alias
  entityType         = null,  // legacy alias
  action_label       = null,
  action_url         = null,
  expires_at         = null,
  source_system      = 'system',
  pinned             = null,

  // Legacy compat
  priority,
}) {
  // Normalize body/message
  const resolvedBody = body ?? message ?? '';

  // Normalize entity fields
  const resolvedEntityId   = linked_entity_id   ?? entityId   ?? null;
  const resolvedEntityType = linked_entity_type  ?? entityType ?? null;

  // Severity from legacy priority
  const resolvedSeverity = severity ?? _priorityToSeverity(priority);

  const resolvedPinned = pinned ?? isPinned(type);

  return {
    notification_id:   uid(),
    type,
    title,
    body:              resolvedBody,
    severity:          resolvedSeverity,
    linked_entity_type:resolvedEntityType,
    linked_entity_id:  resolvedEntityId,
    action_label,
    action_url,
    pinned:            resolvedPinned,
    read_at:           null,
    dismissed_at:      null,
    created_at:        nowIso(),
    expires_at,
    source_system,

    // Legacy compat
    id:         uid(),       // some callers use .id
    isRead:     false,
    priority:   _severityToPriority(resolvedSeverity),
    entityId:   resolvedEntityId,
    entityType: resolvedEntityType,
    message:    resolvedBody,
  };
}

// ─── Dedupe helper ────────────────────────────────────────────────────────────

/**
 * Check if a similar notification was recently pushed to the store.
 * Returns true if deduped (should skip), false if should fire.
 */
export function isDuplicate(notifications, type, entityId) {
  const windowMs = DEDUPE_WINDOW_MS[type] ?? DEDUPE_WINDOW_MS.default;
  if (windowMs === 0) return false; // always fire
  const cutoff = Date.now() - windowMs;
  return notifications.some((n) => {
    const matchType   = n.type === type;
    const matchEntity = !entityId || (n.linked_entity_id ?? n.entityId) === entityId;
    const recent      = new Date(n.created_at ?? n.createdAt).getTime() > cutoff;
    return matchType && matchEntity && recent;
  });
}

// ─── Read / dismiss helpers ───────────────────────────────────────────────────

export function markRead(notification) {
  return { ...notification, read_at: nowIso(), isRead: true };
}

export function markDismissed(notification) {
  return { ...notification, dismissed_at: nowIso() };
}

// ─── Specific notification factories ──────────────────────────────────────────

export function approvalNeededNotification(approval, artifact) {
  return createNotification({
    type:              NOTIFICATION_TYPES.APPROVAL_NEEDED,
    title:             'Approval needed',
    body:              `"${artifact?.title ?? approval.artifactType}" requires your review before it can be sent or exported.`,
    severity:          SEVERITY.IMPORTANT,
    linked_entity_type:'approval',
    linked_entity_id:  approval.id,
    action_label:      'Review',
    action_url:        `/approvals/${approval.id}`,
    source_system:     'approval_service',
  });
}

export function approvalStaleNotification(approval) {
  return createNotification({
    type:              NOTIFICATION_TYPES.APPROVAL_STALE,
    title:             'Approval may be outdated',
    body:              `Source records changed after "${approval.artifactType}" was submitted. Regenerate or acknowledge before approving.`,
    severity:          SEVERITY.IMPORTANT,
    linked_entity_type:'approval',
    linked_entity_id:  approval.id,
    action_label:      'View approval',
    action_url:        `/approvals/${approval.id}`,
    source_system:     'approval_service',
    pinned:            true,
  });
}

export function taskDueNotification(task) {
  const hoursUntil = task.dueDate
    ? Math.round((new Date(task.dueDate) - Date.now()) / 3_600_000)
    : null;
  const urgencyLabel = hoursUntil != null ? `in ${hoursUntil}h` : 'soon';
  return createNotification({
    type:              NOTIFICATION_TYPES.TASK_DUE,
    title:             `Task due ${urgencyLabel}`,
    body:              `"${task.title}" is due ${urgencyLabel}.`,
    severity:          task.priority === 'critical' ? SEVERITY.CRITICAL : SEVERITY.IMPORTANT,
    linked_entity_type:'task',
    linked_entity_id:  task.id,
    action_label:      'Open task',
    action_url:        `/tasks/${task.id}`,
    source_system:     'task_service',
  });
}

export function taskOverdueNotification(task) {
  const daysOverdue = task.daysOverdue ?? 0;
  return createNotification({
    type:              task.priority === 'critical' ? NOTIFICATION_TYPES.CRITICAL_OVERDUE : NOTIFICATION_TYPES.TASK_OVERDUE,
    title:             task.priority === 'critical' ? 'Critical task overdue' : 'Task overdue',
    body:              `"${task.title}" was due ${daysOverdue} day(s) ago.`,
    severity:          task.priority === 'critical' ? SEVERITY.CRITICAL : SEVERITY.IMPORTANT,
    linked_entity_type:'task',
    linked_entity_id:  task.id,
    action_label:      'Open task',
    action_url:        `/tasks/${task.id}`,
    pinned:            task.priority === 'critical',
    source_system:     'task_service',
  });
}

export function meetingReminderNotification(meeting) {
  const mins = meeting.startsAt
    ? Math.round((new Date(meeting.startsAt) - Date.now()) / 60_000)
    : null;
  return createNotification({
    type:              NOTIFICATION_TYPES.MEETING_REMINDER,
    title:             `Meeting in ${mins ?? '?'} minutes`,
    body:              `"${meeting.title}" starts at ${meeting.startsAt ? new Date(meeting.startsAt).toLocaleTimeString() : 'soon'}.`,
    severity:          SEVERITY.IMPORTANT,
    linked_entity_type:'meeting',
    linked_entity_id:  meeting.id,
    action_label:      'Open prep',
    action_url:        `/meetings/${meeting.id}`,
    source_system:     'meeting_service',
  });
}

export function meetingPrepDueNotification(meeting) {
  return createNotification({
    type:              NOTIFICATION_TYPES.MEETING_PREP_DUE,
    title:             'Meeting prep not ready',
    body:              `Prep brief for "${meeting.title}" has not been generated with <24h until the meeting.`,
    severity:          SEVERITY.IMPORTANT,
    linked_entity_type:'meeting',
    linked_entity_id:  meeting.id,
    action_label:      'Generate prep',
    action_url:        `/meetings/${meeting.id}/prep`,
    pinned:            true,
    source_system:     'meeting_service',
  });
}

export function meetingFollowupNotification(meeting) {
  return createNotification({
    type:              NOTIFICATION_TYPES.MEETING_FOLLOWUP_DUE,
    title:             'Meeting follow-up due',
    body:              `Send follow-up for "${meeting.title}".`,
    severity:          SEVERITY.WATCH,
    linked_entity_type:'meeting',
    linked_entity_id:  meeting.id,
    action_label:      'Draft follow-up',
    action_url:        `/meetings/${meeting.id}`,
    source_system:     'meeting_service',
  });
}

export function dealStageChangedNotification(deal, fromStage, toStage) {
  return createNotification({
    type:              NOTIFICATION_TYPES.DEAL_STAGE_CHANGED,
    title:             'Deal stage advanced',
    body:              `${deal.companyName}: ${fromStage} → ${toStage}`,
    severity:          ['loi_sent', 'diligence', 'closing'].includes(toStage) ? SEVERITY.IMPORTANT : SEVERITY.WATCH,
    linked_entity_type:'deal',
    linked_entity_id:  deal.id,
    action_label:      'Open deal',
    action_url:        `/deals/${deal.id}`,
    source_system:     'deal_service',
  });
}

export function dealStalledNotification(deal, daysSince) {
  return createNotification({
    type:              NOTIFICATION_TYPES.DEAL_STALLED,
    title:             'Deal stalled',
    body:              `${deal.companyName} has had no activity for ${daysSince} days.`,
    severity:          daysSince > 21 ? SEVERITY.IMPORTANT : SEVERITY.WATCH,
    linked_entity_type:'deal',
    linked_entity_id:  deal.id,
    action_label:      'Open deal',
    action_url:        `/deals/${deal.id}`,
    source_system:     'pipeline_pressure',
  });
}

export function dealCriticalNotification(deal) {
  return createNotification({
    type:              NOTIFICATION_TYPES.DEAL_CRITICAL,
    title:             'Deal at critical risk',
    body:              `${deal.companyName} is in critical SLA state. Immediate action required.`,
    severity:          SEVERITY.CRITICAL,
    linked_entity_type:'deal',
    linked_entity_id:  deal.id,
    action_label:      'Open deal',
    action_url:        `/deals/${deal.id}`,
    pinned:            true,
    source_system:     'timing_engine',
  });
}

export function relationshipCoolingNotification(contact) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Contact';
  return createNotification({
    type:              NOTIFICATION_TYPES.RELATIONSHIP_COOLING,
    title:             'High-value relationship cooling',
    body:              `${name} is cooling. Last touch was ${contact.daysSinceLastInteraction ?? '?'}+ days ago.`,
    severity:          SEVERITY.WATCH,
    linked_entity_type:'contact',
    linked_entity_id:  contact.id,
    action_label:      'Open relationship',
    action_url:        `/contacts/${contact.id}`,
    source_system:     'relationship_engine',
  });
}

export function boardSeatWeakNotification(seat) {
  return createNotification({
    type:              NOTIFICATION_TYPES.BOARD_SEAT_WEAK,
    title:             `Board seat weak: ${seat.seat_type ?? seat.seatType ?? 'unknown'}`,
    body:              `The ${seat.seat_type ?? seat.seatType ?? 'unknown'} seat is ${seat.health_state ?? 'weak'}. This limits credibility and deal readiness.`,
    severity:          (seat.seat_type ?? seat.seatType) === 'industry_veteran' ? SEVERITY.CRITICAL : SEVERITY.IMPORTANT,
    linked_entity_type:'board_seat',
    linked_entity_id:  seat.id ?? seat.seat_type ?? seat.seatType,
    action_label:      'View board',
    action_url:        '/board',
    pinned:            (seat.seat_type ?? seat.seatType) === 'industry_veteran',
    source_system:     'board_engine',
  });
}

export function boardCandidateFollowupNotification(candidate) {
  return createNotification({
    type:              NOTIFICATION_TYPES.BOARD_CANDIDATE_FOLLOWUP,
    title:             'Board candidate follow-up due',
    body:              `${candidate.name} (${candidate.seat_type ?? candidate.seatType ?? 'board'}) hasn't been followed up with in ${Math.round(candidate.days_since_last_progress ?? 0)} days.`,
    severity:          SEVERITY.WATCH,
    linked_entity_type:'board_candidate',
    linked_entity_id:  candidate.id,
    action_label:      'View candidate',
    action_url:        `/board/candidates/${candidate.id}`,
    source_system:     'board_engine',
  });
}

export function investorFollowupNotification(investor) {
  return createNotification({
    type:              NOTIFICATION_TYPES.INVESTOR_FOLLOWUP_DUE,
    title:             'Investor follow-up due',
    body:              `${investor.name} (${investor.investorStage ?? investor.stage ?? investor.relationshipStage ?? 'unknown stage'}) needs follow-up.`,
    severity:          SEVERITY.WATCH,
    linked_entity_type:'investor',
    linked_entity_id:  investor.id,
    action_label:      'View investor',
    action_url:        `/investors/${investor.id}`,
    source_system:     'investor_engine',
  });
}

export function diligenceBlockerNotification(issue) {
  return createNotification({
    type:              NOTIFICATION_TYPES.DILIGENCE_BLOCKER,
    title:             'Diligence blocker unresolved',
    body:              `"${issue.title ?? 'Unnamed issue'}" (${issue.severity ?? 'unknown'}) has no resolution after ${issue.days_open ?? '?'} days.`,
    severity:          issue.severity === 'fatal' ? SEVERITY.CRITICAL : SEVERITY.IMPORTANT,
    linked_entity_type:'diligence_issue',
    linked_entity_id:  issue.id,
    action_label:      'Open issue',
    action_url:        `/deals/${issue.dealId}/diligence`,
    pinned:            issue.severity === 'fatal',
    source_system:     'diligence_engine',
  });
}

export function artifactStaleNotification(artifact) {
  return createNotification({
    type:              NOTIFICATION_TYPES.ARTIFACT_STALE,
    title:             'Artifact may be outdated',
    body:              `"${artifact.title}" (${artifact.artifactType}) was generated from records that have since changed. Review or regenerate.`,
    severity:          artifact.approvalRequired ? SEVERITY.IMPORTANT : SEVERITY.WATCH,
    linked_entity_type:'artifact',
    linked_entity_id:  artifact.artifactId,
    action_label:      'View artifact',
    action_url:        `/artifacts/${artifact.artifactId}`,
    source_system:     'artifact_store',
  });
}

export function integrationDegradedNotification(integration) {
  return createNotification({
    type:              NOTIFICATION_TYPES.INTEGRATION_DEGRADED,
    title:             `Integration degraded: ${integration.name ?? integration.id}`,
    body:              `${integration.name ?? integration.id} is ${integration.status ?? 'unhealthy'}. This may affect sending and scheduling.`,
    severity:          SEVERITY.CRITICAL,
    linked_entity_type:'integration',
    linked_entity_id:  integration.id,
    action_label:      'Check integrations',
    action_url:        '/settings/integrations',
    pinned:            true,
    source_system:     'integration_health',
  });
}

export function recoveryNeededNotification(recoveryAction) {
  return createNotification({
    type:              NOTIFICATION_TYPES.RECOVERY_NEEDED,
    title:             `Recovery action needed`,
    body:              recoveryAction.title ?? 'A recovery action requires attention.',
    severity:          recoveryAction.severity === 'critical_intervention' ? SEVERITY.CRITICAL : SEVERITY.IMPORTANT,
    linked_entity_type:recoveryAction.entity_type,
    linked_entity_id:  recoveryAction.entity_id,
    action_label:      'View recovery',
    action_url:        `/recovery/${recoveryAction.recovery_id}`,
    source_system:     'recovery_engine',
  });
}

// ─── Batch generators ─────────────────────────────────────────────────────────

/**
 * Generate notifications for all pending approvals.
 * Returns only new ones (deduped against existing store notifications).
 */
export function generateApprovalNotifications(approvals, existingNotifications = []) {
  const out = [];
  for (const approval of approvals) {
    if (approval.status !== 'submitted') continue;
    if (isDuplicate(existingNotifications, NOTIFICATION_TYPES.APPROVAL_NEEDED, approval.id)) continue;
    out.push(approvalNeededNotification(approval, { title: approval.artifactType }));
  }
  return out;
}

/**
 * Generate notifications for overdue tasks.
 */
export function generateTaskNotifications(tasks, existingNotifications = []) {
  const out = [];
  const now = Date.now();
  for (const task of tasks) {
    if (task.status === 'done' || task.status === 'archived') continue;
    if (!task.dueDate) continue;
    const dueMs    = new Date(task.dueDate).getTime();
    const daysOver = (now - dueMs) / 86_400_000;
    if (daysOver <= 0) continue;
    if (isDuplicate(existingNotifications, task.priority === 'critical' ? NOTIFICATION_TYPES.CRITICAL_OVERDUE : NOTIFICATION_TYPES.TASK_OVERDUE, task.id)) continue;
    out.push(taskOverdueNotification({ ...task, daysOverdue: Math.round(daysOver) }));
  }
  return out;
}

/**
 * Generate notifications for stale artifacts that require approval.
 */
export function generateArtifactStaleNotifications(artifacts, existingNotifications = []) {
  const out = [];
  const now = Date.now();
  for (const art of artifacts) {
    if (art.status === 'archived') continue;
    const isTimeStale = art.staleAfter && new Date(art.staleAfter).getTime() < now;
    if (!isTimeStale) continue;
    if (isDuplicate(existingNotifications, NOTIFICATION_TYPES.ARTIFACT_STALE, art.artifactId)) continue;
    out.push(artifactStaleNotification(art));
  }
  return out;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _priorityToSeverity(priority) {
  const map = { critical: SEVERITY.CRITICAL, high: SEVERITY.IMPORTANT, medium: SEVERITY.WATCH, low: SEVERITY.INFO };
  return map[priority] ?? SEVERITY.WATCH;
}

function _severityToPriority(severity) {
  const map = { [SEVERITY.CRITICAL]: 'critical', [SEVERITY.IMPORTANT]: 'high', [SEVERITY.WATCH]: 'medium', [SEVERITY.INFO]: 'low' };
  return map[severity] ?? 'medium';
}

export const NotificationService = {
  NOTIFICATION_TYPES,
  SEVERITY,
  isPinned,
  isDuplicate,
  createNotification,
  markRead,
  markDismissed,

  // Specific factories
  approvalNeededNotification,
  approvalStaleNotification,
  taskDueNotification,
  taskOverdueNotification,
  meetingReminderNotification,
  meetingPrepDueNotification,
  meetingFollowupNotification,
  dealStageChangedNotification,
  dealStalledNotification,
  dealCriticalNotification,
  relationshipCoolingNotification,
  boardSeatWeakNotification,
  boardCandidateFollowupNotification,
  investorFollowupNotification,
  diligenceBlockerNotification,
  artifactStaleNotification,
  integrationDegradedNotification,
  recoveryNeededNotification,

  // Batch generators
  generateApprovalNotifications,
  generateTaskNotifications,
  generateArtifactStaleNotifications,
};
export default NotificationService;
