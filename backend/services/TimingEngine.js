/**
 * TimingEngine — deterministic, reusable SLA state calculators.
 *
 * Rules:
 *  - All calculations are deterministic. No AI involvement.
 *  - All thresholds sourced from CadenceThresholds. No magic numbers here.
 *  - Every calculator returns a normalized TimingResult object.
 *  - AI may read these results to explain risk, but must not define it.
 */

import {
  TASK_THRESHOLDS,
  DEAL_STAGE_THRESHOLDS,
  RELATIONSHIP_THRESHOLDS,
  BOARD_THRESHOLDS,
  DILIGENCE_THRESHOLDS,
  MEETING_THRESHOLDS,
  INVESTOR_THRESHOLDS,
  APPROVAL_THRESHOLDS,
  ARTIFACT_THRESHOLDS,
} from './CadenceThresholds.js';

// ─── Core time helpers ────────────────────────────────────────────────────────

export function daysBetween(a, b = new Date()) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return (tb - ta) / 86_400_000;
}

export function hoursBetween(a, b = new Date()) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return (tb - ta) / 3_600_000;
}

export function hoursUntil(ts) {
  return (new Date(ts).getTime() - Date.now()) / 3_600_000;
}

export function daysAgo(ts) {
  if (!ts) return null;
  return daysBetween(ts, new Date());
}

export function hoursAgo(ts) {
  if (!ts) return null;
  return hoursBetween(ts, new Date());
}

function _now() { return new Date(); }

// ─── Base TimingResult shape ──────────────────────────────────────────────────

function _result(entityType, entityId, fields) {
  return {
    entity_type:                    entityType,
    entity_id:                      entityId ?? null,
    calculated_at:                  new Date().toISOString(),
    ...fields,
  };
}

// ─── Task SLA calculator ──────────────────────────────────────────────────────

/**
 * @param {object} task
 * @param {string} task.id
 * @param {'critical'|'high'|'medium'|'low'} task.priority
 * @param {string} [task.due_at]        — explicit due timestamp
 * @param {string} [task.dueDate]       — alias
 * @param {string} [task.created_at]
 * @param {boolean} [task.blocked]
 * @param {boolean} [task.completed]
 * @returns TimingResult
 */
export function calcTaskSlaState(task) {
  const priority  = task.priority ?? 'medium';
  const blocked   = Boolean(task.blocked);
  const completed = Boolean(task.completed || task.completedAt || task.completed_at);

  if (completed) {
    return _result('task', task.id, { timing_state: 'completed', sla_status: 'met', risk_level: 'none' });
  }
  if (blocked) {
    return _result('task', task.id, { timing_state: 'blocked', sla_status: 'blocked', risk_level: 'watch', priority });
  }

  const dueTsRaw  = task.due_at ?? task.dueDate ?? task.due_date;
  const createdAt = task.created_at ?? task.createdAt;

  // Resolve effective due timestamp
  const dueTs = dueTsRaw
    ? new Date(dueTsRaw)
    : createdAt
      ? new Date(new Date(createdAt).getTime() + TASK_THRESHOLDS.default_due_hours[priority] * 3_600_000)
      : null;

  const hoursLeft    = dueTs ? hoursUntil(dueTs)                              : null;
  const hoursOverdue = dueTs && hoursLeft < 0 ? Math.abs(hoursLeft)           : 0;
  const dueSoonLimit = TASK_THRESHOLDS.due_soon_hours[priority];
  const criticalODLimit = TASK_THRESHOLDS.critical_overdue_hours[priority];

  let timing_state, risk_level, sla_status;

  if (hoursLeft === null) {
    timing_state = 'on_track'; sla_status = 'no_due_date'; risk_level = 'low';
  } else if (hoursLeft < 0) {
    if (hoursOverdue >= criticalODLimit) {
      timing_state = 'critical_overdue'; sla_status = 'breached'; risk_level = 'critical';
    } else {
      timing_state = 'overdue'; sla_status = 'breached'; risk_level = 'high';
    }
  } else if (hoursLeft <= dueSoonLimit) {
    timing_state = 'due_soon'; sla_status = 'at_risk'; risk_level = 'medium';
  } else {
    timing_state = 'on_track'; sla_status = 'healthy'; risk_level = 'low';
  }

  return _result('task', task.id, {
    timing_state,
    sla_status,
    risk_level,
    priority,
    due_at:          dueTs?.toISOString() ?? null,
    hours_until_due: hoursLeft !== null ? Math.round(hoursLeft * 10) / 10 : null,
    hours_overdue:   hoursOverdue > 0 ? Math.round(hoursOverdue * 10) / 10 : 0,
    days_overdue:    hoursOverdue > 0 ? Math.round((hoursOverdue / 24) * 10) / 10 : 0,
  });
}

// ─── Deal stage velocity calculator ──────────────────────────────────────────

/**
 * @param {object} deal
 * @param {string} deal.id
 * @param {string} deal.stage
 * @param {string} [deal.stage_entered_at]  — when current stage was entered
 * @param {string} [deal.stageEnteredAt]
 * @param {string} [deal.last_activity_at]
 * @param {string} [deal.lastInteractionAt]
 * @param {number} [deal.days_since_activity]
 * @returns TimingResult
 */
export function calcDealVelocityState(deal) {
  const stage      = deal.stage ?? 'identified';
  const enteredAt  = deal.stage_entered_at ?? deal.stageEnteredAt ?? deal.created_at ?? deal.createdAt;
  const lastTouch  = deal.last_activity_at ?? deal.lastInteractionAt ?? deal.updatedAt ?? deal.updated_at;

  const hoursInStage   = enteredAt ? hoursAgo(enteredAt) : null;
  const hoursSinceTouch = lastTouch ? hoursAgo(lastTouch) : null;

  const watchH    = DEAL_STAGE_THRESHOLDS.watch_hours[stage]    ?? 168;
  const slowH     = DEAL_STAGE_THRESHOLDS.slow_hours[stage]     ?? 240;
  const criticalH = DEAL_STAGE_THRESHOLDS.critical_hours[stage] ?? 480;

  let velocity_state, risk_level;
  if (hoursInStage === null) {
    velocity_state = 'healthy'; risk_level = 'low';
  } else if (hoursInStage >= criticalH) {
    velocity_state = 'critical'; risk_level = 'critical';
  } else if (hoursInStage >= slowH) {
    velocity_state = 'slow'; risk_level = 'high';
  } else if (hoursInStage >= watchH) {
    velocity_state = 'watch'; risk_level = 'medium';
  } else {
    velocity_state = 'healthy'; risk_level = 'low';
  }

  return _result('deal', deal.id, {
    timing_state:             velocity_state,
    velocity_state,
    sla_status:               velocity_state === 'healthy' ? 'healthy' : (velocity_state === 'critical' ? 'breached' : 'at_risk'),
    risk_level,
    stage,
    days_in_stage:            hoursInStage !== null ? Math.round((hoursInStage / 24) * 10) / 10 : null,
    hours_in_stage:           hoursInStage !== null ? Math.round(hoursInStage) : null,
    days_since_last_touch:    hoursSinceTouch !== null ? Math.round((hoursSinceTouch / 24) * 10) / 10 : null,
    stage_sla_watch_hours:    watchH,
    stage_sla_slow_hours:     slowH,
    stage_sla_critical_hours: criticalH,
  });
}

/**
 * Calculate deal heat state based on recency and activity signals.
 */
export function calcDealHeat(deal) {
  const lastTouch = deal.last_activity_at ?? deal.lastInteractionAt ?? deal.updatedAt ?? deal.updated_at;
  const hoursIdle = lastTouch ? hoursAgo(lastTouch) : Infinity;
  const hd        = DEAL_STAGE_THRESHOLDS.heat_decay;

  let heat_state;
  if (hoursIdle <= hd.hot_max_silence_hours)      heat_state = 'hot';
  else if (hoursIdle <= hd.warm_max_silence_hours) heat_state = 'warm';
  else if (hoursIdle <= hd.lukewarm_max_silence_hours) heat_state = 'lukewarm';
  else if (hoursIdle <= hd.cold_max_silence_hours) heat_state = 'cold';
  else                                              heat_state = 'dead';

  return { heat_state, hours_idle: Math.round(hoursIdle), days_idle: Math.round(hoursIdle / 24) };
}

// ─── Relationship cadence calculator ─────────────────────────────────────────

/**
 * @param {object} rel
 * @param {string} rel.id
 * @param {string} [rel.cadence_profile]     — key in RELATIONSHIP_THRESHOLDS.silence_hours
 * @param {string} [rel.last_meaningful_touch_at]
 * @param {string} [rel.lastInteractionAt]
 * @param {boolean} [rel.open_loop]
 * @param {string} [rel.post_meeting_at]     — timestamp of last meeting
 * @param {boolean} [rel.intro_requested]
 */
export function calcRelationshipState(rel) {
  const profile  = rel.cadence_profile ?? rel.influence_level ?? 'default';
  const lastTouch = rel.last_meaningful_touch_at ?? rel.lastInteractionAt ?? rel.updatedAt ?? rel.updated_at;
  const hoursIdle = lastTouch ? hoursAgo(lastTouch) : null;

  const threshH = RELATIONSHIP_THRESHOLDS.silence_hours[profile]
    ?? RELATIONSHIP_THRESHOLDS.silence_hours.default;

  let timing_state = 'healthy', risk_level = 'low';

  if (hoursIdle !== null) {
    if (hoursIdle >= threshH * RELATIONSHIP_THRESHOLDS.critical_multiplier) {
      timing_state = 'critical'; risk_level = 'critical';
    } else if (hoursIdle >= threshH * RELATIONSHIP_THRESHOLDS.stalled_multiplier) {
      timing_state = 'stalled'; risk_level = 'high';
    } else if (hoursIdle >= threshH * RELATIONSHIP_THRESHOLDS.cooling_multiplier) {
      timing_state = 'cooling'; risk_level = 'medium';
    } else if (hoursIdle >= threshH * RELATIONSHIP_THRESHOLDS.watch_multiplier) {
      timing_state = 'watch'; risk_level = 'low';
    }
  }

  // Check post-event follow-up obligations
  const alerts = [];
  const postMeetingAt = rel.post_meeting_at ?? rel.last_meeting_at;
  if (postMeetingAt) {
    const hrsSinceMeeting = hoursAgo(postMeetingAt);
    if (hrsSinceMeeting > RELATIONSHIP_THRESHOLDS.follow_up_hours.post_meeting && !rel.post_meeting_followed_up) {
      alerts.push({ alert: 'post_meeting_follow_up_overdue', hours_elapsed: Math.round(hrsSinceMeeting) });
      if (risk_level === 'low') risk_level = 'medium';
    }
  }
  if (rel.open_loop && hoursIdle > RELATIONSHIP_THRESHOLDS.follow_up_hours.open_loop) {
    alerts.push({ alert: 'open_loop_unresolved', hours_elapsed: Math.round(hoursIdle) });
  }
  if (rel.intro_requested && hoursIdle > RELATIONSHIP_THRESHOLDS.follow_up_hours.intro_requested) {
    alerts.push({ alert: 'intro_request_no_follow_up', hours_elapsed: Math.round(hoursIdle) });
    if (risk_level === 'low') risk_level = 'medium';
  }

  return _result('relationship', rel.id, {
    timing_state,
    sla_status: timing_state === 'healthy' || timing_state === 'watch' ? 'healthy' : 'at_risk',
    risk_level,
    cadence_profile:            profile,
    days_since_last_touch:      hoursIdle !== null ? Math.round((hoursIdle / 24) * 10) / 10 : null,
    silence_threshold_hours:    threshH,
    alerts,
  });
}

// ─── Board candidate timing calculator ───────────────────────────────────────

/**
 * @param {object} candidate
 * @param {string} candidate.id
 * @param {string} [candidate.outreach_status]  — 'first_touch'|'follow_up_1'|'post_meeting'|'soft_interest'|'commitment_pending'
 * @param {string} [candidate.last_outreach_at]
 * @param {string} [candidate.last_meeting_at]
 * @param {boolean} [candidate.reply_received]
 * @param {string} [candidate.engagement_stage]  — 'advanced'|'committed'|'passed'
 */
export function calcBoardCandidateState(candidate) {
  const status    = candidate.outreach_status ?? candidate.engagement_stage ?? 'fresh';
  const lastTouch = candidate.last_outreach_at ?? candidate.lastInteractionAt ?? candidate.updated_at;
  const hoursIdle = lastTouch ? hoursAgo(lastTouch) : null;

  // Terminal states
  if (['advanced', 'committed', 'passed'].includes(status)) {
    return _result('board_candidate', candidate.id, {
      timing_state: status, sla_status: 'n/a', risk_level: 'none', hours_idle: 0,
    });
  }

  const followUpMap = BOARD_THRESHOLDS.follow_up_hours;

  // Determine follow-up window for current status
  const windowH = {
    first_touch:         followUpMap.first_touch_no_reply,
    follow_up_1:         followUpMap.follow_up_1_no_reply,
    post_meeting:        followUpMap.post_meeting,
    soft_interest:       followUpMap.soft_interest,
    commitment_pending:  followUpMap.commitment_pending,
  }[status] ?? BOARD_THRESHOLDS.cooling_after_hours;

  let timing_state = 'fresh', risk_level = 'low';

  if (hoursIdle !== null) {
    if (hoursIdle >= BOARD_THRESHOLDS.stalled_after_hours) {
      timing_state = 'stalled'; risk_level = 'high';
    } else if (hoursIdle >= BOARD_THRESHOLDS.cooling_after_hours) {
      timing_state = 'cooling'; risk_level = 'medium';
    } else if (hoursIdle >= windowH) {
      timing_state = 'follow_up_due'; risk_level = 'medium';
    } else if (!candidate.reply_received && status === 'first_touch') {
      timing_state = 'waiting_reply'; risk_level = 'low';
    }
  }

  return _result('board_candidate', candidate.id, {
    timing_state,
    sla_status:      timing_state === 'stalled' ? 'breached' : timing_state === 'follow_up_due' ? 'at_risk' : 'healthy',
    risk_level,
    outreach_status: status,
    hours_idle:      hoursIdle !== null ? Math.round(hoursIdle) : null,
    days_idle:       hoursIdle !== null ? Math.round((hoursIdle / 24) * 10) / 10 : null,
    follow_up_window_hours: windowH,
  });
}

/**
 * Calculate board seat inactivity timing.
 */
export function calcBoardSeatTiming(seat) {
  const lastProgress = seat.last_progress_event_at ?? seat.last_candidate_added_at ?? seat.updated_at;
  const hoursIdle    = lastProgress ? hoursAgo(lastProgress) : null;
  const isHighPri    = ['industry_veteran', 'lead_investor', 'domain_expert'].includes(seat.seat_type);
  const viableCandidates = seat.viable_candidate_count ?? 0;

  const alerts = [];

  if (viableCandidates === 0) {
    alerts.push({ alert: 'weak_seat_no_viable_candidates', severity: 'high' });
  }
  if (hoursIdle !== null) {
    const limit = isHighPri
      ? BOARD_THRESHOLDS.seat_inactivity.high_priority_seat_alert
      : BOARD_THRESHOLDS.seat_inactivity.any_seat_no_progress;
    if (hoursIdle >= limit) {
      alerts.push({ alert: 'seat_inactivity_breach', severity: isHighPri ? 'critical' : 'high', hours_idle: Math.round(hoursIdle) });
    }
  }

  const risk_level = alerts.some(a => a.severity === 'critical') ? 'critical'
    : alerts.some(a => a.severity === 'high') ? 'high' : 'low';

  return _result('board_seat', seat.id, {
    timing_state:  alerts.length > 0 ? 'needs_attention' : 'active',
    sla_status:    alerts.length > 0 ? 'at_risk' : 'healthy',
    risk_level,
    days_idle:     hoursIdle !== null ? Math.round((hoursIdle / 24) * 10) / 10 : null,
    viable_candidates: viableCandidates,
    alerts,
  });
}

// ─── Diligence issue SLA calculator ──────────────────────────────────────────

/**
 * @param {object} issue
 * @param {string} issue.id
 * @param {'fatal'|'critical'|'material'|'watch'|'info'} issue.severity
 * @param {string} [issue.opened_at]
 * @param {string} [issue.last_updated_at]
 * @param {string} [issue.owner_id]
 * @param {string} [issue.status]
 */
export function calcDiligenceIssueSla(issue) {
  const severity     = issue.severity ?? 'watch';
  const openedAt     = issue.opened_at ?? issue.created_at ?? issue.createdAt;
  const lastMovement = issue.last_updated_at ?? issue.updatedAt ?? issue.updated_at ?? openedAt;
  const hasOwner     = Boolean(issue.owner_id ?? issue.assignee_id ?? issue.owner);
  const isResolved   = ['resolved', 'closed'].includes(issue.status);

  if (isResolved) {
    return _result('diligence_issue', issue.id, {
      timing_state: 'resolved', sla_status: 'met', risk_level: 'none',
    });
  }

  const hoursOpen     = openedAt     ? hoursAgo(openedAt)     : null;
  const hoursSinceMove = lastMovement ? hoursAgo(lastMovement) : null;
  const slaH          = DILIGENCE_THRESHOLDS.sla_hours[severity] ?? 168;
  const moveAlertH    = DILIGENCE_THRESHOLDS.movement_alert_hours[severity] ?? slaH;

  let timing_state = 'in_progress', risk_level = 'low', sla_status = 'healthy';
  const alerts = [];

  if (severity === 'fatal' && !hasOwner) {
    alerts.push({ alert: 'fatal_no_owner', severity: 'critical' });
    risk_level = 'critical';
  }
  if (hoursOpen !== null && hoursOpen >= slaH) {
    timing_state = 'sla_breached'; sla_status = 'breached';
    risk_level = severity === 'fatal' || severity === 'critical' ? 'critical' : 'high';
    alerts.push({ alert: 'sla_breached', hours_open: Math.round(hoursOpen), sla_hours: slaH });
  } else if (hoursSinceMove !== null && hoursSinceMove >= moveAlertH) {
    timing_state = 'stalled'; sla_status = 'at_risk';
    if (risk_level !== 'critical') risk_level = 'medium';
    alerts.push({ alert: 'no_movement', hours_since_last_move: Math.round(hoursSinceMove) });
  }

  return _result('diligence_issue', issue.id, {
    timing_state,
    sla_status,
    risk_level,
    severity,
    has_owner:          hasOwner,
    days_open:          hoursOpen !== null ? Math.round((hoursOpen / 24) * 10) / 10 : null,
    days_since_movement: hoursSinceMove !== null ? Math.round((hoursSinceMove / 24) * 10) / 10 : null,
    sla_hours:          slaH,
    alerts,
  });
}

// ─── Meeting timing calculator ────────────────────────────────────────────────

/**
 * @param {object} meeting
 * @param {string} meeting.id
 * @param {string} [meeting.scheduled_at]
 * @param {string} [meeting.completed_at]
 * @param {boolean} [meeting.prep_done]
 * @param {boolean} [meeting.summary_logged]
 * @param {boolean} [meeting.follow_up_sent]
 * @param {boolean} [meeting.is_important]
 * @param {string} [meeting.status]  — 'scheduled'|'completed'|'cancelled'
 */
export function calcMeetingState(meeting) {
  const scheduledAt  = meeting.scheduled_at ?? meeting.scheduledAt ?? meeting.datetime;
  const completedAt  = meeting.completed_at ?? meeting.completedAt;
  const isCompleted  = Boolean(completedAt) || meeting.status === 'completed';
  const isCancelled  = meeting.status === 'cancelled';
  const prepDone     = Boolean(meeting.prep_done ?? meeting.prepDone);
  const summaryDone  = Boolean(meeting.summary_logged ?? meeting.summary ?? meeting.summaryLogged);
  const followUpDone = Boolean(meeting.follow_up_sent ?? meeting.followUpSent);
  const isImportant  = Boolean(meeting.is_important ?? meeting.isImportant ?? true);

  if (isCancelled) {
    return _result('meeting', meeting.id, { timing_state: 'cancelled', sla_status: 'n/a', risk_level: 'none' });
  }

  const alerts = [];

  // Pre-meeting: check prep
  if (!isCompleted && scheduledAt) {
    const hrsUntil = hoursUntil(scheduledAt);
    if (hrsUntil <= MEETING_THRESHOLDS.prep_warning_before_hours && !prepDone && isImportant) {
      alerts.push({ alert: 'prep_missing_imminent', hours_until_meeting: Math.round(hrsUntil) });
    } else if (hrsUntil <= MEETING_THRESHOLDS.prep_due_before_hours && !prepDone) {
      alerts.push({ alert: 'prep_due', hours_until_meeting: Math.round(hrsUntil) });
    }
    const timing_state = !prepDone && hrsUntil <= MEETING_THRESHOLDS.prep_warning_before_hours
      ? 'prep_due' : 'scheduled';
    return _result('meeting', meeting.id, {
      timing_state,
      sla_status:       alerts.length ? 'at_risk' : 'healthy',
      risk_level:       alerts.length ? 'medium' : 'low',
      hours_until:      Math.round(hrsUntil),
      prep_done:        prepDone,
      alerts,
    });
  }

  // Post-meeting
  if (isCompleted && completedAt) {
    const hrsSince = hoursAgo(completedAt);
    if (!summaryDone) alerts.push({ alert: 'summary_missing', hours_since_completion: Math.round(hrsSince) });
    if (!followUpDone && hrsSince > MEETING_THRESHOLDS.follow_up_due_after_hours) {
      alerts.push({ alert: 'follow_up_overdue', hours_since_completion: Math.round(hrsSince) });
    }
    if (!followUpDone && hrsSince > MEETING_THRESHOLDS.follow_up_stalled_after_hours) {
      alerts.push({ alert: 'follow_up_stalled', hours_since_completion: Math.round(hrsSince) });
    }
    const timing_state = followUpDone && summaryDone ? 'completed'
      : hrsSince > MEETING_THRESHOLDS.follow_up_stalled_after_hours ? 'stalled'
      : hrsSince > MEETING_THRESHOLDS.follow_up_due_after_hours ? 'follow_up_due' : 'completed';
    return _result('meeting', meeting.id, {
      timing_state,
      sla_status:    alerts.length ? 'at_risk' : 'met',
      risk_level:    alerts.some(a => a.alert === 'follow_up_stalled') ? 'high' : alerts.length ? 'medium' : 'none',
      hours_since_completion: Math.round(hrsSince),
      summary_done:  summaryDone,
      follow_up_done: followUpDone,
      alerts,
    });
  }

  return _result('meeting', meeting.id, { timing_state: 'scheduled', sla_status: 'healthy', risk_level: 'low', alerts });
}

// ─── Investor cadence calculator ──────────────────────────────────────────────

/**
 * @param {object} investor
 * @param {string} investor.id
 * @param {string} [investor.stage]
 * @param {string} [investor.last_touch_at]
 * @param {string} [investor.last_meeting_at]
 * @param {boolean} [investor.memo_sent]
 */
export function calcInvestorState(investor) {
  const stage       = investor.stage ?? 'identified';
  const lastTouch   = investor.last_touch_at ?? investor.lastInteractionAt ?? investor.updated_at;
  const hoursIdle   = lastTouch ? hoursAgo(lastTouch) : null;
  const watchLimitH = INVESTOR_THRESHOLDS.watch_silence_hours[stage];

  if (stage === 'committed' || stage === 'passed') {
    return _result('investor', investor.id, { timing_state: stage, sla_status: 'n/a', risk_level: 'none' });
  }

  let timing_state = 'active', risk_level = 'low';
  const alerts = [];

  if (watchLimitH !== null && hoursIdle !== null) {
    if (hoursIdle >= watchLimitH * 3) { timing_state = 'stalled';  risk_level = 'critical'; }
    else if (hoursIdle >= watchLimitH * 2) { timing_state = 'cold';    risk_level = 'high'; }
    else if (hoursIdle >= watchLimitH * 1.5) { timing_state = 'watch';   risk_level = 'medium'; }
    else if (hoursIdle >= watchLimitH) { timing_state = 'warming'; risk_level = 'low'; }
  }

  // Post-meeting follow-up
  if (investor.last_meeting_at) {
    const hrsSinceMeeting = hoursAgo(investor.last_meeting_at);
    if (hrsSinceMeeting > INVESTOR_THRESHOLDS.follow_up_hours.post_meeting && !investor.post_meeting_followed_up) {
      alerts.push({ alert: 'post_meeting_follow_up_overdue', hours_elapsed: Math.round(hrsSinceMeeting) });
    }
  }

  return _result('investor', investor.id, {
    timing_state,
    sla_status:            timing_state === 'stalled' ? 'breached' : timing_state === 'cold' ? 'at_risk' : 'healthy',
    risk_level,
    stage,
    days_since_last_touch: hoursIdle !== null ? Math.round((hoursIdle / 24) * 10) / 10 : null,
    alerts,
  });
}

// ─── Approval stale calculator ────────────────────────────────────────────────

/**
 * @param {object} approval
 * @param {string} approval.id
 * @param {string} approval.status
 * @param {string} [approval.submitted_at]
 * @param {string} [approval.stale_after]
 * @param {string} [approval.artifact_type]
 */
export function calcApprovalState(approval) {
  const status      = approval.status;
  const submittedAt = approval.submitted_at ?? approval.submittedAt ?? approval.created_at;
  const staleAfter  = approval.stale_after  ?? approval.staleAfter;

  if (['approved', 'applied', 'rejected', 'expired'].includes(status)) {
    return _result('approval', approval.id, {
      timing_state: status, sla_status: status === 'rejected' ? 'n/a' : 'met', risk_level: 'none',
    });
  }

  const hoursWaiting = submittedAt ? hoursAgo(submittedAt) : null;
  const isSourceStale = staleAfter ? new Date(staleAfter) < _now() : false;

  let timing_state = 'pending', risk_level = 'low', sla_status = 'healthy';
  const alerts = [];

  if (isSourceStale) {
    alerts.push({ alert: 'source_record_changed_while_pending', action: 'require_regenerate_or_ack' });
    risk_level = 'high';
  }
  if (hoursWaiting !== null) {
    if (hoursWaiting >= APPROVAL_THRESHOLDS.very_stale_hours) {
      timing_state = 'very_stale'; sla_status = 'breached';
      risk_level = 'high';
      alerts.push({ alert: 'very_stale', hours_waiting: Math.round(hoursWaiting) });
    } else if (hoursWaiting >= APPROVAL_THRESHOLDS.stale_warning_hours) {
      timing_state = 'stale_warning'; sla_status = 'at_risk';
      if (risk_level === 'low') risk_level = 'medium';
      alerts.push({ alert: 'stale_warning', hours_waiting: Math.round(hoursWaiting) });
    }
  }

  return _result('approval', approval.id, {
    timing_state,
    sla_status,
    risk_level,
    artifact_type:   approval.artifact_type ?? null,
    hours_waiting:   hoursWaiting !== null ? Math.round(hoursWaiting) : null,
    source_is_stale: isSourceStale,
    alerts,
  });
}

// ─── Artifact staleness calculator ───────────────────────────────────────────

/**
 * @param {object} artifact
 * @param {string} artifact.artifactId
 * @param {string} artifact.artifactType
 * @param {string} artifact.generatedAt
 * @param {string} [artifact.staleAfter]
 * @param {string} [artifact.approvalStatus]
 */
export function calcArtifactStaleness(artifact) {
  const type        = artifact.artifactType ?? artifact.artifact_type ?? 'default';
  const generatedAt = artifact.generatedAt   ?? artifact.generated_at;
  const staleAfterTs = artifact.staleAfter   ?? artifact.stale_after;

  const staleH = ARTIFACT_THRESHOLDS.stale_hours[type]
    ?? ARTIFACT_THRESHOLDS.stale_hours.default;

  const isStale = staleAfterTs
    ? new Date(staleAfterTs) < _now()
    : generatedAt
      ? hoursAgo(generatedAt) >= staleH
      : false;

  const hoursOld = generatedAt ? hoursAgo(generatedAt) : null;

  return _result('artifact', artifact.artifactId, {
    timing_state:   isStale ? 'stale' : 'fresh',
    sla_status:     isStale ? 'stale' : 'healthy',
    risk_level:     isStale ? 'medium' : 'none',
    is_stale:       isStale,
    hours_old:      hoursOld !== null ? Math.round(hoursOld) : null,
    stale_hours_threshold: staleH,
    staleness_warning: isStale
      ? 'This draft may be outdated because underlying records changed after generation. Review before approval.'
      : null,
  });
}

// ─── Aggregate summary generators ────────────────────────────────────────────

/**
 * Generate a full timing summary for Command Center.
 * Accepts entity sets in the format returned by data stores.
 *
 * @param {object} entitySets
 * @param {Array} [entitySets.tasks]
 * @param {Array} [entitySets.deals]
 * @param {Array} [entitySets.relationships]
 * @param {Array} [entitySets.board_candidates]
 * @param {Array} [entitySets.board_seats]
 * @param {Array} [entitySets.diligence_issues]
 * @param {Array} [entitySets.meetings]
 * @param {Array} [entitySets.investors]
 * @param {Array} [entitySets.approvals]
 * @param {Array} [entitySets.artifacts]
 * @returns {TimingSummary}
 */
export function generateTimingSummary(entitySets = {}) {
  const {
    tasks = [], deals = [], relationships = [], board_candidates = [],
    board_seats = [], diligence_issues = [], meetings = [],
    investors = [], approvals = [], artifacts = [],
  } = entitySets;

  const taskStates         = tasks.map(calcTaskSlaState);
  const dealVelocities     = deals.map(calcDealVelocityState);
  const dealHeats          = deals.map(calcDealHeat);
  const relStates          = relationships.map(calcRelationshipState);
  const candidateStates    = board_candidates.map(calcBoardCandidateState);
  const seatStates         = board_seats.map(calcBoardSeatTiming);
  const issueStates        = diligence_issues.map(calcDiligenceIssueSla);
  const meetingStates      = meetings.map(calcMeetingState);
  const investorStates     = investors.map(calcInvestorState);
  const approvalStates     = approvals.map(calcApprovalState);
  const artifactStates     = artifacts.map(calcArtifactStaleness);

  const count = (arr, pred) => arr.filter(pred).length;

  return {
    generated_at: new Date().toISOString(),

    tasks: {
      total:            tasks.length,
      on_track:         count(taskStates, s => s.timing_state === 'on_track'),
      due_soon:         count(taskStates, s => s.timing_state === 'due_soon'),
      overdue:          count(taskStates, s => s.timing_state === 'overdue'),
      critical_overdue: count(taskStates, s => s.timing_state === 'critical_overdue'),
      blocked:          count(taskStates, s => s.timing_state === 'blocked'),
      items:            taskStates,
    },

    deals: {
      total:    deals.length,
      healthy:  count(dealVelocities, s => s.velocity_state === 'healthy'),
      watch:    count(dealVelocities, s => s.velocity_state === 'watch'),
      slow:     count(dealVelocities, s => s.velocity_state === 'slow'),
      critical: count(dealVelocities, s => s.velocity_state === 'critical'),
      hot:      count(dealHeats, s => s.heat_state === 'hot'),
      warm:     count(dealHeats, s => s.heat_state === 'warm'),
      cold:     count(dealHeats, s => ['cold', 'dead'].includes(s.heat_state)),
      items:    dealVelocities.map((v, i) => ({ ...v, heat: dealHeats[i] })),
    },

    relationships: {
      total:    relationships.length,
      healthy:  count(relStates, s => s.timing_state === 'healthy'),
      watch:    count(relStates, s => s.timing_state === 'watch'),
      cooling:  count(relStates, s => s.timing_state === 'cooling'),
      stalled:  count(relStates, s => s.timing_state === 'stalled'),
      critical: count(relStates, s => s.timing_state === 'critical'),
      items:    relStates,
    },

    board: {
      candidates: {
        total:          board_candidates.length,
        follow_up_due:  count(candidateStates, s => s.timing_state === 'follow_up_due'),
        cooling:        count(candidateStates, s => s.timing_state === 'cooling'),
        stalled:        count(candidateStates, s => s.timing_state === 'stalled'),
        items:          candidateStates,
      },
      seats: {
        total:           board_seats.length,
        needs_attention: count(seatStates, s => s.timing_state === 'needs_attention'),
        critical:        count(seatStates, s => s.risk_level === 'critical'),
        items:           seatStates,
      },
    },

    diligence: {
      total:       diligence_issues.length,
      sla_breached: count(issueStates, s => s.sla_status === 'breached'),
      stalled:     count(issueStates, s => s.timing_state === 'stalled'),
      fatal_no_owner: count(issueStates, s => s.alerts?.some(a => a.alert === 'fatal_no_owner')),
      items:       issueStates,
    },

    meetings: {
      total:          meetings.length,
      prep_due:       count(meetingStates, s => s.timing_state === 'prep_due'),
      follow_up_due:  count(meetingStates, s => s.timing_state === 'follow_up_due'),
      stalled:        count(meetingStates, s => s.timing_state === 'stalled'),
      items:          meetingStates,
    },

    investors: {
      total:   investors.length,
      active:  count(investorStates, s => s.timing_state === 'active'),
      warming: count(investorStates, s => s.timing_state === 'warming'),
      watch:   count(investorStates, s => s.timing_state === 'watch'),
      cold:    count(investorStates, s => s.timing_state === 'cold'),
      stalled: count(investorStates, s => s.timing_state === 'stalled'),
      items:   investorStates,
    },

    approvals: {
      total:        approvals.length,
      pending:      count(approvalStates, s => s.timing_state === 'pending'),
      stale_warning:count(approvalStates, s => s.timing_state === 'stale_warning'),
      very_stale:   count(approvalStates, s => s.timing_state === 'very_stale'),
      source_stale: count(approvalStates, s => s.source_is_stale),
      items:        approvalStates,
    },

    artifacts: {
      total: artifacts.length,
      stale: count(artifactStates, s => s.is_stale),
      items: artifactStates,
    },
  };
}

/**
 * Generate a flat list of SLA alerts across all entity types.
 * Returns items sorted by severity.
 */
export function generateSlaAlerts(entitySets = {}) {
  const summary = generateTimingSummary(entitySets);
  const alerts  = [];

  const push = (entityType, item, alert, severity) =>
    alerts.push({ entity_type: entityType, entity_id: item.entity_id, alert, severity, item });

  summary.tasks.items.forEach(t => {
    if (t.timing_state === 'critical_overdue') push('task', t, 'critical_overdue', 'critical');
    else if (t.timing_state === 'overdue')      push('task', t, 'overdue', 'high');
    else if (t.timing_state === 'due_soon')     push('task', t, 'due_soon', 'medium');
  });

  summary.deals.items.forEach(d => {
    if (d.velocity_state === 'critical') push('deal', d, 'deal_stage_critical', 'critical');
    else if (d.velocity_state === 'slow') push('deal', d, 'deal_stage_slow', 'high');
  });

  summary.relationships.items.forEach(r => {
    if (r.timing_state === 'critical') push('relationship', r, 'relationship_critical', 'critical');
    else if (r.timing_state === 'stalled') push('relationship', r, 'relationship_stalled', 'high');
    else if (r.timing_state === 'cooling') push('relationship', r, 'relationship_cooling', 'medium');
  });

  summary.board.candidates.items.forEach(c => {
    if (c.timing_state === 'stalled')       push('board_candidate', c, 'candidate_stalled', 'high');
    else if (c.timing_state === 'follow_up_due') push('board_candidate', c, 'follow_up_due', 'medium');
  });

  summary.board.seats.items.forEach(s => {
    s.alerts?.forEach(a => push('board_seat', s, a.alert, a.severity === 'critical' ? 'critical' : 'high'));
  });

  summary.diligence.items.forEach(i => {
    i.alerts?.forEach(a => push('diligence_issue', i, a.alert, a.severity ?? 'high'));
  });

  summary.meetings.items.forEach(m => {
    m.alerts?.forEach(a => push('meeting', m, a.alert, 'medium'));
  });

  summary.approvals.items.forEach(a => {
    if (a.timing_state === 'very_stale')   push('approval', a, 'approval_very_stale', 'high');
    if (a.source_is_stale)                  push('approval', a, 'approval_source_stale', 'high');
  });

  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  return alerts.sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3));
}

export default {
  daysBetween, hoursBetween, hoursUntil, daysAgo, hoursAgo,
  calcTaskSlaState,
  calcDealVelocityState, calcDealHeat,
  calcRelationshipState,
  calcBoardCandidateState, calcBoardSeatTiming,
  calcDiligenceIssueSla,
  calcMeetingState,
  calcInvestorState,
  calcApprovalState,
  calcArtifactStaleness,
  generateTimingSummary,
  generateSlaAlerts,
};
