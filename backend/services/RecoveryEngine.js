/**
 * RecoveryEngine — generates deterministic recovery actions for breached SLAs.
 *
 * Rules:
 *  - Every breached SLA should produce a recovery action with owner, due date,
 *    risk explanation, and severity.
 *  - Recovery actions are deterministic. AI may later enrich them with
 *    messaging drafts or commentary but must not define the recovery type.
 *  - Recovery severity is sourced from CadenceThresholds.RECOVERY_SEVERITY.
 */

import { RECOVERY_SEVERITY, TASK_THRESHOLDS } from './CadenceThresholds.js';

// ─── Recovery action types ────────────────────────────────────────────────────

export const RECOVERY_ACTION_TYPES = {
  // Deals
  FOLLOW_UP_SELLER:        'follow_up_seller',
  REQUEST_MISSING_DOCS:    'request_missing_docs',
  ASSIGN_ISSUE_OWNER:      'assign_issue_owner',
  SCHEDULE_DECISION_REVIEW:'schedule_decision_review',
  RERUN_UNDERWRITING:      'rerun_underwriting',
  PAUSE_WITH_REASON:       'pause_with_reason',
  KILL_DEAL_WITH_REASON:   'kill_deal_with_reason',

  // Relationships
  SEND_RE_ENGAGEMENT:      'send_re_engagement',
  CLOSE_OPEN_LOOP:         'close_open_loop',
  SCHEDULE_FOLLOW_UP_CALL: 'schedule_follow_up_call',

  // Board
  SEND_BOARD_FOLLOW_UP:    'send_board_follow_up',
  IDENTIFY_NEW_CANDIDATES: 'identify_new_candidates',
  RECLASSIFY_CANDIDATE:    'reclassify_candidate',

  // Diligence
  TRIAGE_FATAL_ISSUE:      'triage_fatal_issue',
  ESCALATE_ISSUE:          'escalate_issue',
  REQUEST_SELLER_INFO:     'request_seller_info',

  // Meetings
  SEND_MEETING_FOLLOW_UP:  'send_meeting_follow_up',
  COMPLETE_MEETING_SUMMARY:'complete_meeting_summary',
  SCHEDULE_PREP:           'schedule_prep',

  // Approvals / artifacts
  REFRESH_ARTIFACT:        'refresh_artifact',
  REVIEW_STALE_APPROVAL:   'review_stale_approval',

  // General
  ASSIGN_OWNER:            'assign_owner',
  COMPLETE_OVERDUE_TASK:   'complete_overdue_task',
};

// ─── ID helper ────────────────────────────────────────────────────────────────

function _id() {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function _dueAt(hours) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

// ─── Core recovery builder ────────────────────────────────────────────────────

function _action({
  recovery_id   = _id(),
  action_type,
  severity,
  title,
  reason,
  entity_type,
  entity_id     = null,
  owner         = null,
  due_at        = null,
  due_hours     = null,
  context       = {},
}) {
  const cfg = RECOVERY_SEVERITY[severity] ?? RECOVERY_SEVERITY.standard_recovery;
  return {
    recovery_id,
    action_type,
    severity,
    title,
    reason,
    entity_type,
    entity_id,
    owner,
    priority:    cfg.priority,
    due_at:      due_at ?? _dueAt(due_hours ?? cfg.due_hours),
    generated_at: new Date().toISOString(),
    context,
    applied:     false,
  };
}

// ─── Entity-specific generators ───────────────────────────────────────────────

export function recoveryForTask(timingResult, task = {}) {
  const { timing_state, priority, hours_overdue } = timingResult;
  if (!['overdue', 'critical_overdue', 'blocked'].includes(timing_state)) return null;

  const severity = timing_state === 'critical_overdue' ? 'critical_intervention'
    : timing_state === 'blocked' ? 'urgent_recovery'
    : priority === 'critical' ? 'urgent_recovery' : 'standard_recovery';

  return _action({
    action_type:  RECOVERY_ACTION_TYPES.COMPLETE_OVERDUE_TASK,
    severity,
    title:        `Complete overdue task: ${task.title ?? task.name ?? task.id}`,
    reason:       `Task is ${timing_state.replace('_', ' ')}. ${hours_overdue ? `${Math.round(hours_overdue)}h overdue.` : ''}`,
    entity_type:  'task',
    entity_id:    task.id,
    owner:        task.assignee_id ?? task.owner_id ?? null,
    context:      { priority, timing_state, hours_overdue },
  });
}

export function recoveryForDeal(velocityResult, deal = {}) {
  const { velocity_state, stage, days_in_stage } = velocityResult;
  if (!['slow', 'critical'].includes(velocity_state)) return null;

  const severity = velocity_state === 'critical' ? 'critical_intervention' : 'urgent_recovery';

  // Choose most appropriate action type by stage
  const actionType = {
    contacted:            RECOVERY_ACTION_TYPES.FOLLOW_UP_SELLER,
    responded:            RECOVERY_ACTION_TYPES.FOLLOW_UP_SELLER,
    financials_requested: RECOVERY_ACTION_TYPES.REQUEST_MISSING_DOCS,
    financials_received:  RECOVERY_ACTION_TYPES.SCHEDULE_DECISION_REVIEW,
    under_review:         RECOVERY_ACTION_TYPES.SCHEDULE_DECISION_REVIEW,
    loi_sent:             RECOVERY_ACTION_TYPES.FOLLOW_UP_SELLER,
    diligence:            RECOVERY_ACTION_TYPES.ASSIGN_ISSUE_OWNER,
    financing:            RECOVERY_ACTION_TYPES.SCHEDULE_DECISION_REVIEW,
  }[stage] ?? RECOVERY_ACTION_TYPES.FOLLOW_UP_SELLER;

  return _action({
    action_type:  actionType,
    severity,
    title:        `Recover stalled deal in stage "${stage}"`,
    reason:       `Deal has been in "${stage}" for ${days_in_stage?.toFixed(1) ?? '?'} days without sufficient progress.`,
    entity_type:  'deal',
    entity_id:    deal.id,
    owner:        deal.owner_id ?? deal.assigned_to ?? null,
    context:      { velocity_state, stage, days_in_stage },
  });
}

export function recoveryForRelationship(relResult, rel = {}) {
  const { timing_state, days_since_last_touch, alerts } = relResult;
  if (!['cooling', 'stalled', 'critical'].includes(timing_state)) {
    if (!alerts?.length) return null;
  }

  const severity = timing_state === 'critical' ? 'critical_intervention'
    : timing_state === 'stalled' ? 'urgent_recovery' : 'standard_recovery';

  const postMeetingAlert = alerts?.find(a => a.alert === 'post_meeting_follow_up_overdue');
  const openLoopAlert    = alerts?.find(a => a.alert === 'open_loop_unresolved');

  const actionType = postMeetingAlert ? RECOVERY_ACTION_TYPES.SEND_MEETING_FOLLOW_UP
    : openLoopAlert ? RECOVERY_ACTION_TYPES.CLOSE_OPEN_LOOP
    : timing_state === 'critical' ? RECOVERY_ACTION_TYPES.SCHEDULE_FOLLOW_UP_CALL
    : RECOVERY_ACTION_TYPES.SEND_RE_ENGAGEMENT;

  return _action({
    action_type: actionType,
    severity,
    title:       `Re-engage ${rel.name ?? rel.id}: ${timing_state} relationship`,
    reason:      `No meaningful touch in ${days_since_last_touch?.toFixed(0) ?? '?'} days. State: ${timing_state}.`,
    entity_type: 'relationship',
    entity_id:   rel.id,
    owner:       rel.owner_id ?? null,
    context:     { timing_state, days_since_last_touch, alerts },
  });
}

export function recoveryForBoardCandidate(candidateResult, candidate = {}) {
  const { timing_state, days_idle } = candidateResult;
  if (!['follow_up_due', 'cooling', 'stalled'].includes(timing_state)) return null;

  const severity = timing_state === 'stalled' ? 'urgent_recovery' : 'standard_recovery';

  return _action({
    action_type: RECOVERY_ACTION_TYPES.SEND_BOARD_FOLLOW_UP,
    severity,
    title:       `Follow up with board candidate ${candidate.name ?? candidate.id}`,
    reason:      `Candidate is ${timing_state}. ${days_idle?.toFixed(0) ?? '?'} days without activity.`,
    entity_type: 'board_candidate',
    entity_id:   candidate.id,
    owner:       candidate.owner_id ?? null,
    context:     { timing_state, days_idle, outreach_status: candidateResult.outreach_status },
  });
}

export function recoveryForBoardSeat(seatResult, seat = {}) {
  if (!seatResult.alerts?.length) return null;
  const severity = seatResult.risk_level === 'critical' ? 'critical_intervention' : 'urgent_recovery';
  const noViable = seatResult.alerts.find(a => a.alert === 'weak_seat_no_viable_candidates');

  return _action({
    action_type: noViable
      ? RECOVERY_ACTION_TYPES.IDENTIFY_NEW_CANDIDATES
      : RECOVERY_ACTION_TYPES.SEND_BOARD_FOLLOW_UP,
    severity,
    title:       `Address board seat inactivity: ${seat.seat_type ?? seat.id}`,
    reason:      seatResult.alerts.map(a => a.alert).join('; '),
    entity_type: 'board_seat',
    entity_id:   seat.id,
    owner:       seat.owner_id ?? null,
    context:     { alerts: seatResult.alerts, viable_candidates: seatResult.viable_candidates },
  });
}

export function recoveryForDiligenceIssue(issueResult, issue = {}) {
  if (!['sla_breached', 'stalled'].includes(issueResult.timing_state) && !issueResult.alerts?.length) return null;

  const fatalNoOwner = issueResult.alerts?.find(a => a.alert === 'fatal_no_owner');
  const severity = fatalNoOwner ? 'critical_intervention'
    : issueResult.severity === 'fatal' ? 'critical_intervention'
    : issueResult.severity === 'critical' ? 'urgent_recovery' : 'standard_recovery';

  const actionType = fatalNoOwner
    ? RECOVERY_ACTION_TYPES.ASSIGN_OWNER
    : RECOVERY_ACTION_TYPES.ESCALATE_ISSUE;

  return _action({
    action_type: actionType,
    severity,
    title:       `${fatalNoOwner ? 'Assign owner to' : 'Escalate'} ${issueResult.severity} diligence issue`,
    reason:      `Issue ${fatalNoOwner ? 'has no owner' : 'breached SLA'}. Severity: ${issueResult.severity}. Days open: ${issueResult.days_open?.toFixed(0) ?? '?'}.`,
    entity_type: 'diligence_issue',
    entity_id:   issue.id,
    owner:       issue.owner_id ?? null,
    context:     { severity: issueResult.severity, timing_state: issueResult.timing_state, alerts: issueResult.alerts },
  });
}

export function recoveryForMeeting(meetingResult, meeting = {}) {
  const summaryAlert  = meetingResult.alerts?.find(a => a.alert === 'summary_missing');
  const followUpAlert = meetingResult.alerts?.find(a => ['follow_up_overdue', 'follow_up_stalled'].includes(a.alert));
  const prepAlert     = meetingResult.alerts?.find(a => ['prep_due', 'prep_missing_imminent'].includes(a.alert));
  if (!summaryAlert && !followUpAlert && !prepAlert) return null;

  const severity = meetingResult.alerts?.find(a => a.alert === 'follow_up_stalled')
    ? 'urgent_recovery'
    : meetingResult.alerts?.find(a => a.alert === 'prep_missing_imminent')
    ? 'urgent_recovery'
    : 'standard_recovery';

  const actionType = prepAlert ? RECOVERY_ACTION_TYPES.SCHEDULE_PREP
    : summaryAlert ? RECOVERY_ACTION_TYPES.COMPLETE_MEETING_SUMMARY
    : RECOVERY_ACTION_TYPES.SEND_MEETING_FOLLOW_UP;

  return _action({
    action_type: actionType,
    severity,
    title:       prepAlert ? `Complete meeting prep: ${meeting.title ?? meeting.id}`
      : summaryAlert ? `Log meeting summary: ${meeting.title ?? meeting.id}`
      : `Send post-meeting follow-up: ${meeting.title ?? meeting.id}`,
    reason:      meetingResult.alerts?.map(a => a.alert).join('; '),
    entity_type: 'meeting',
    entity_id:   meeting.id,
    owner:       meeting.owner_id ?? meeting.organizer_id ?? null,
    context:     { timing_state: meetingResult.timing_state, alerts: meetingResult.alerts },
  });
}

export function recoveryForApproval(approvalResult, approval = {}) {
  if (!['stale_warning', 'very_stale'].includes(approvalResult.timing_state) && !approvalResult.source_is_stale) return null;

  const severity = approvalResult.source_is_stale || approvalResult.timing_state === 'very_stale'
    ? 'urgent_recovery' : 'standard_recovery';

  const actionType = approvalResult.source_is_stale
    ? RECOVERY_ACTION_TYPES.REFRESH_ARTIFACT
    : RECOVERY_ACTION_TYPES.REVIEW_STALE_APPROVAL;

  return _action({
    action_type: actionType,
    severity,
    title:       approvalResult.source_is_stale
      ? `Source changed — refresh or acknowledge: ${approval.artifact_type ?? approval.id}`
      : `Review long-waiting approval: ${approval.artifact_type ?? approval.id}`,
    reason:      approvalResult.source_is_stale
      ? 'Underlying record changed while approval was pending. Must regenerate or reviewer must acknowledge.'
      : `Approval has been waiting ${approvalResult.hours_waiting ?? '?'}h without action.`,
    entity_type: 'approval',
    entity_id:   approval.id,
    owner:       approval.reviewer_id ?? null,
    context:     { timing_state: approvalResult.timing_state, source_is_stale: approvalResult.source_is_stale, hours_waiting: approvalResult.hours_waiting },
  });
}

// ─── Bulk recovery from SLA alert list ───────────────────────────────────────

/**
 * Generate all recovery actions from a flat SLA alert list (from TimingEngine.generateSlaAlerts).
 * Pass entity maps for enrichment: { tasks: {id: task}, deals: {id: deal}, ... }
 *
 * @param {Array}  slaAlerts    — from TimingEngine.generateSlaAlerts()
 * @param {object} entityMaps   — keyed by entity_type, values are id→entity maps
 * @returns {RecoveryAction[]}
 */
export function generateRecoveryActions(slaAlerts = [], entityMaps = {}) {
  const actions = [];

  for (const alert of slaAlerts) {
    const entity = entityMaps[alert.entity_type]?.[alert.entity_id] ?? {};
    entity.id = entity.id ?? alert.entity_id;
    let action = null;

    switch (alert.entity_type) {
      case 'task':            action = recoveryForTask(alert.item, entity); break;
      case 'deal':            action = recoveryForDeal(alert.item, entity); break;
      case 'relationship':    action = recoveryForRelationship(alert.item, entity); break;
      case 'board_candidate': action = recoveryForBoardCandidate(alert.item, entity); break;
      case 'board_seat':      action = recoveryForBoardSeat(alert.item, entity); break;
      case 'diligence_issue': action = recoveryForDiligenceIssue(alert.item, entity); break;
      case 'meeting':         action = recoveryForMeeting(alert.item, entity); break;
      case 'approval':        action = recoveryForApproval(alert.item, entity); break;
    }

    if (action) actions.push(action);
  }

  // Deduplicate by entity_id + action_type, keep most severe
  const seen = new Map();
  for (const a of actions) {
    const key = `${a.entity_type}:${a.entity_id}:${a.action_type}`;
    const existing = seen.get(key);
    if (!existing || _severityRank(a.severity) < _severityRank(existing.severity)) {
      seen.set(key, a);
    }
  }

  const severityOrder = { critical_intervention: 0, urgent_recovery: 1, standard_recovery: 2, light_recovery: 3 };
  return [...seen.values()].sort((a, b) =>
    (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
  );
}

/**
 * Build a task pack from a recovery action — ready to insert into TaskService.
 */
export function buildRecoveryTaskPack(recoveryAction) {
  const cfg = RECOVERY_SEVERITY[recoveryAction.severity] ?? RECOVERY_SEVERITY.standard_recovery;
  return {
    recovery_id:  recoveryAction.recovery_id,
    tasks: [{
      title:        recoveryAction.title,
      description:  recoveryAction.reason,
      priority:     cfg.priority,
      due_at:       recoveryAction.due_at,
      entity_type:  recoveryAction.entity_type,
      entity_id:    recoveryAction.entity_id,
      assignee_id:  recoveryAction.owner ?? null,
      source:       'recovery_engine',
      recovery_action_type: recoveryAction.action_type,
      tags:         ['recovery', recoveryAction.action_type, recoveryAction.severity],
    }],
    generated_at: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _severityRank(s) {
  return { critical_intervention: 0, urgent_recovery: 1, standard_recovery: 2, light_recovery: 3 }[s] ?? 3;
}

export default {
  RECOVERY_ACTION_TYPES,
  recoveryForTask, recoveryForDeal, recoveryForRelationship,
  recoveryForBoardCandidate, recoveryForBoardSeat,
  recoveryForDiligenceIssue, recoveryForMeeting, recoveryForApproval,
  generateRecoveryActions, buildRecoveryTaskPack,
};
