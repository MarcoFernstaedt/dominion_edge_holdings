/**
 * NextActionEngine — deterministic calculation of what to do next.
 *
 * Rules:
 *  - All bottleneck detection is deterministic.
 *  - AI may summarize or reword outputs — it must never drive ranking.
 *  - Scores are explainable and reproducible.
 *  - single_best_next_action always has exact steps.
 *  - TimingEngine SLA states feed urgency scoring directly.
 */

import {
  calcTaskSlaState, calcDealVelocityState, calcRelationshipState,
  calcBoardCandidateState, calcDiligenceIssueSla,
  generateSlaAlerts,
} from './TimingEngine.js';
import { RELATIONSHIP_THRESHOLDS, DEAL_STAGE_THRESHOLDS } from './CadenceThresholds.js';

// ─── Weighting constants ──────────────────────────────────────────────────────

const WEIGHTS = {
  blocking_severity:     0.30,
  unlock_value:          0.20,
  time_sensitivity:      0.20,   // raised from 0.15 — timing urgency now matters more
  entity_value:          0.15,
  momentum_preservation: 0.10,
  ease_of_completion:    0.05,   // lowered from 0.10 — don't reward easy-but-stale
};

// Severity → numeric
const SEVERITY_SCORE = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 };

// Timing state → time_sensitivity boost
const TIMING_URGENCY = {
  critical_overdue: 1.0,
  overdue:          0.85,
  due_soon:         0.7,
  critical:         1.0,   // deal/relationship critical state
  slow:             0.75,
  stalled:          0.8,
  cooling:          0.5,
  follow_up_due:    0.65,
  on_track:         0.3,
  healthy:          0.2,
};

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Calculate next actions for the current state.
 *
 * @param {object} ctx
 * @param {string}   ctx.current_phase
 * @param {object[]} ctx.tasks            — all open/blocked tasks
 * @param {object[]} ctx.deals            — deal records with stage/value/daysSinceActivity
 * @param {object[]} ctx.relationships    — relationship records with recency/status
 * @param {object[]} ctx.meetings         — upcoming/past meetings
 * @param {object[]} ctx.gates            — failing gates from WorkflowEngine
 * @param {object}   ctx.scores           — current scoring engine outputs
 * @param {object[]} ctx.proof_gaps       — missing proof items
 * @returns {NextActionResult}
 */
export function calculate(ctx = {}) {
  const {
    current_phase        = 'targeting',
    tasks                = [],
    deals                = [],
    relationships        = [],
    meetings             = [],
    gates                = [],
    scores               = {},
    proof_gaps           = [],
    board_candidates     = [],
    diligence_issues     = [],
  } = ctx;

  // 1. Compute timing states for all relevant entities
  const taskTimingMap   = new Map(tasks.map(t   => [t.id, calcTaskSlaState(t)]));
  const dealTimingMap   = new Map(deals.map(d   => [d.id, calcDealVelocityState(d)]));
  const relTimingMap    = new Map(relationships.map(r => [r.id, calcRelationshipState(r)]));
  const issueTimingMap  = new Map(diligence_issues.map(i => [i.id, calcDiligenceIssueSla(i)]));

  // 2. Identify all candidate actions (now timing-aware)
  const candidates = _gatherCandidates({
    current_phase, tasks, deals, relationships, meetings, gates, proof_gaps,
    board_candidates, diligence_issues,
    taskTimingMap, dealTimingMap, relTimingMap, issueTimingMap,
  });

  // 3. Score each candidate
  const scored = candidates.map((c) => ({ ...c, _score: _scoreAction(c) }))
    .sort((a, b) => b._score - a._score);

  // 4. Extract outputs
  const top3    = scored.slice(0, 3).map(_formatAction);
  const best    = top3[0] ?? null;
  const overdue = _detectOverdue(tasks, deals, taskTimingMap);
  const stalled = _detectStalled(deals, relationships, dealTimingMap, relTimingMap);
  const bottleneck = _detectBottleneck({ current_phase, gates, scored, overdue, stalled });

  // 5. Build timing summary for Command Center consumers
  const slaAlerts = generateSlaAlerts({ tasks, deals, relationships, meetings, diligence_issues });

  return {
    current_phase,
    primary_bottleneck:        bottleneck.label,
    primary_bottleneck_reason: bottleneck.reason,
    top_3_actions:             top3,
    single_best_next_action:   best,
    overdue_critical_items:    overdue,
    stalled_entities:          stalled,
    proof_gaps,
    execution_risk_level:      _riskLevel({ gates, overdue, stalled, scores, slaAlerts }),
    sla_alerts_count:          slaAlerts.length,
    critical_sla_alerts:       slaAlerts.filter(a => a.severity === 'critical').length,
    what_unlocks_next:         best?.unlocks_after ?? null,
    calculated_at:             new Date().toISOString(),
  };
}

// ─── Candidate gathering ──────────────────────────────────────────────────────

function _gatherCandidates({
  current_phase, tasks, deals, relationships, meetings, gates, proof_gaps,
  board_candidates = [], diligence_issues = [],
  taskTimingMap = new Map(), dealTimingMap = new Map(),
  relTimingMap = new Map(), issueTimingMap = new Map(),
}) {
  const candidates = [];

  // Gate-failing tasks — highest priority candidates
  for (const gate of gates.filter((g) => g.status === 'fail')) {
    candidates.push({
      title:            `Resolve blocking gate: ${gate.gate_key}`,
      exact_steps:      [gate.recommended_fix, `Verify gate passes after fix`],
      entity_type:      'gate',
      entity_ids:       gate.blocking_entity_ids ?? [],
      estimated_minutes: 30,
      proof_type:       'record_updated',
      why_now:          `Blocking phase exit: ${current_phase}`,
      risk_if_ignored:  `Cannot advance to next phase`,
      unlocks_after:    `Phase gate ${gate.gate_key} cleared`,
      required_assets:  [],
      phase_key:        current_phase,
      _severity:        gate.severity === 'critical' ? 1.0 : 0.75,
      _unlock_value:    0.9,
      _time_sensitivity: 0.8,
      _entity_value:    0.7,
      _momentum:        0.6,
      _ease:            0.4,
    });
  }

  // Overdue required tasks
  const now = Date.now();
  for (const task of tasks.filter((t) => t.is_required && t.proof_status !== 'proven' && t.dueDate && new Date(t.dueDate) < now)) {
    candidates.push({
      title:            `Complete overdue required task: ${task.title}`,
      exact_steps:      [`Open task "${task.title}"`, `Complete and submit proof`, `Mark task complete`],
      entity_type:      'task',
      entity_ids:       [task.id],
      estimated_minutes: 20,
      proof_type:       task.proof_type ?? 'record_updated',
      why_now:          `Overdue by ${Math.ceil((now - new Date(task.dueDate)) / 86400000)} day(s)`,
      risk_if_ignored:  `Blocking gate ${task.blocking_gate_keys?.join(', ') ?? 'workflow'}`,
      unlocks_after:    task.blocking_gate_keys?.join(', ') ?? null,
      required_assets:  [],
      phase_key:        task.phase_key ?? current_phase,
      _severity:        0.8,
      _unlock_value:    0.7,
      _time_sensitivity: 1.0,
      _entity_value:    0.6,
      _momentum:        0.5,
      _ease:            0.5,
    });
  }

  // Proof gaps
  for (const gap of proof_gaps) {
    candidates.push({
      title:            `Submit missing proof: ${gap.proof_type} for ${gap.entity_label ?? gap.entity_id}`,
      exact_steps:      [`Locate proof artifact for ${gap.proof_type}`, `Upload or link proof`, `Confirm proof validated`],
      entity_type:      gap.entity_type ?? 'unknown',
      entity_ids:       [gap.entity_id],
      estimated_minutes: 15,
      proof_type:       gap.proof_type,
      why_now:          `Proof missing; gate blocked`,
      risk_if_ignored:  `Task cannot be marked complete without proof`,
      unlocks_after:    gap.unlocks ?? null,
      required_assets:  [],
      phase_key:        current_phase,
      _severity:        0.75,
      _unlock_value:    0.65,
      _time_sensitivity: 0.7,
      _entity_value:    0.5,
      _momentum:        0.5,
      _ease:            0.6,
    });
  }

  // Deals with timing SLA issues (uses TimingEngine velocity state)
  for (const deal of deals.filter((d) => d.stage !== 'closed' && d.stage !== 'dead')) {
    const timing = dealTimingMap.get(deal.id) ?? calcDealVelocityState(deal);
    if (!['watch', 'slow', 'critical'].includes(timing.velocity_state)) continue;
    // Also check legacy daysSinceActivity for backwards-compat
    const daysSince = deal.daysSinceActivity ?? timing.days_since_last_touch ?? 0;
    if (timing.velocity_state === 'healthy' && daysSince <= 7) continue;

    const urgency = TIMING_URGENCY[timing.velocity_state] ?? 0.5;
    candidates.push({
      title:            `Re-engage ${timing.velocity_state} deal: ${deal.name ?? deal.id}`,
      exact_steps:      [
        `Review last interaction for deal "${deal.name ?? deal.id}"`,
        `Identify specific stall point in stage "${timing.stage ?? deal.stage}"`,
        `Send follow-up or schedule call with seller contact`,
        `Log activity and update deal stage`,
      ],
      entity_type:      'deal',
      entity_ids:       [deal.id],
      estimated_minutes: 25,
      proof_type:       'call_logged',
      why_now:          `Deal is ${timing.velocity_state} — ${timing.days_in_stage?.toFixed(0) ?? daysSince} days in stage "${timing.stage ?? deal.stage}"`,
      risk_if_ignored:  `Seller may disengage or choose another buyer`,
      unlocks_after:    `Deal back in active conversation`,
      required_assets:  ['meeting_prep', 'contact_info'],
      phase_key:        current_phase,
      timing_state:     timing.velocity_state,
      _severity:        timing.velocity_state === 'critical' ? 0.9 : timing.velocity_state === 'slow' ? 0.75 : 0.55,
      _unlock_value:    _dealValue(deal),
      _time_sensitivity: urgency,
      _entity_value:    _dealValue(deal),
      _momentum:        0.7,
      _ease:            0.5,
    });
  }

  // Relationships with timing-based cooling/stalled/critical state
  for (const rel of relationships.filter((r) => r.status !== 'inactive')) {
    const timing = relTimingMap.get(rel.id) ?? calcRelationshipState(rel);
    if (!['watch', 'cooling', 'stalled', 'critical'].includes(timing.timing_state)) continue;

    const urgency = TIMING_URGENCY[timing.timing_state] ?? 0.4;
    candidates.push({
      title:            `Re-activate ${timing.timing_state} relationship: ${rel.name ?? rel.id}`,
      exact_steps:      [
        `Review last interaction with ${rel.name ?? rel.id}`,
        `Draft and send re-engagement message`,
        `Log outreach activity`,
      ],
      entity_type:      'relationship',
      entity_ids:       [rel.id],
      estimated_minutes: 20,
      proof_type:       'message_sent',
      why_now:          `${timing.days_since_last_touch?.toFixed(0) ?? '?'} days since last contact — relationship is ${timing.timing_state}`,
      risk_if_ignored:  `Loss of warm relationship and potential deal or referral`,
      unlocks_after:    `Relationship reactivated`,
      required_assets:  ['relationship_summary'],
      phase_key:        current_phase,
      timing_state:     timing.timing_state,
      _severity:        timing.timing_state === 'critical' ? 0.8 : timing.timing_state === 'stalled' ? 0.65 : 0.4,
      _unlock_value:    _relValue(rel),
      _time_sensitivity: urgency,
      _entity_value:    _relValue(rel),
      _momentum:        0.6,
      _ease:            0.6,
    });
  }

  // Board candidates with follow-up due
  for (const candidate of board_candidates) {
    const timing = calcBoardCandidateState(candidate);
    if (!['follow_up_due', 'cooling', 'stalled'].includes(timing.timing_state)) continue;
    candidates.push({
      title:            `Follow up with board candidate: ${candidate.name ?? candidate.id}`,
      exact_steps:      [`Open board candidate record`, `Send follow-up message or schedule next step`, `Log activity`],
      entity_type:      'board_candidate',
      entity_ids:       [candidate.id],
      estimated_minutes: 15,
      proof_type:       'message_sent',
      why_now:          `Candidate is ${timing.timing_state} — ${timing.days_idle?.toFixed(0) ?? '?'} days without activity`,
      risk_if_ignored:  `Candidate may disengage before committing to seat`,
      unlocks_after:    `Board seat progress advanced`,
      required_assets:  [],
      phase_key:        current_phase,
      timing_state:     timing.timing_state,
      _severity:        timing.timing_state === 'stalled' ? 0.75 : 0.55,
      _unlock_value:    0.7,
      _time_sensitivity: TIMING_URGENCY[timing.timing_state] ?? 0.5,
      _entity_value:    0.65,
      _momentum:        0.7,
      _ease:            0.6,
    });
  }

  // Critical/fatal diligence issues with no movement
  for (const issue of diligence_issues) {
    const timing = issueTimingMap.get(issue.id) ?? calcDiligenceIssueSla(issue);
    if (timing.sla_status !== 'breached' && timing.timing_state !== 'stalled') continue;
    if (timing.timing_state === 'resolved') continue;
    candidates.push({
      title:            `Address ${timing.severity ?? issue.severity} diligence issue: ${issue.title ?? issue.id}`,
      exact_steps:      [`Open diligence issue`, `Assign owner if missing`, `Define resolution path and deadline`, `Log movement`],
      entity_type:      'diligence_issue',
      entity_ids:       [issue.id],
      estimated_minutes: 20,
      proof_type:       'issue_status_changed',
      why_now:          timing.sla_status === 'breached' ? `SLA breached — ${timing.days_open?.toFixed(0) ?? '?'} days open` : `No movement in ${timing.days_since_movement?.toFixed(0) ?? '?'} days`,
      risk_if_ignored:  `Diligence blocker may delay or kill close`,
      unlocks_after:    `Diligence issue resolved`,
      required_assets:  [],
      phase_key:        current_phase,
      timing_state:     timing.timing_state,
      _severity:        timing.severity === 'fatal' ? 1.0 : timing.severity === 'critical' ? 0.9 : 0.7,
      _unlock_value:    0.8,
      _time_sensitivity: timing.sla_status === 'breached' ? 1.0 : 0.7,
      _entity_value:    0.75,
      _momentum:        0.8,
      _ease:            0.4,
    });
  }

  // Unprepped upcoming meetings (within 48 hours)
  for (const mtg of meetings.filter((m) => !m.prep_done && _hoursUntil(m.datetime) < 48 && _hoursUntil(m.datetime) > 0)) {
    candidates.push({
      title:            `Prepare for upcoming meeting: ${mtg.title}`,
      exact_steps:      [
        `Open meeting record for "${mtg.title}"`,
        `Generate or review meeting prep brief`,
        `Confirm attendees and agenda`,
      ],
      entity_type:      'meeting',
      entity_ids:       [mtg.id],
      estimated_minutes: 20,
      proof_type:       'deliverable_generated',
      why_now:          `Meeting in ${Math.ceil(_hoursUntil(mtg.datetime))} hour(s)`,
      risk_if_ignored:  `Enter meeting unprepared — reduce conversion probability`,
      unlocks_after:    `Meeting ${mtg.title} conducted productively`,
      required_assets:  ['meeting_prep'],
      phase_key:        current_phase,
      _severity:        0.7,
      _unlock_value:    0.6,
      _time_sensitivity: 1.0,
      _entity_value:    0.6,
      _momentum:        0.75,
      _ease:            0.7,
    });
  }

  return candidates;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function _scoreAction(candidate) {
  return (
    WEIGHTS.blocking_severity    * (candidate._severity ?? 0.5) +
    WEIGHTS.unlock_value         * (candidate._unlock_value ?? 0.5) +
    WEIGHTS.time_sensitivity     * (candidate._time_sensitivity ?? 0.5) +
    WEIGHTS.entity_value         * (candidate._entity_value ?? 0.5) +
    WEIGHTS.momentum_preservation * (candidate._momentum ?? 0.5) +
    WEIGHTS.ease_of_completion   * (candidate._ease ?? 0.5)
  );
}

function _formatAction(c) {
  return {
    title:             c.title,
    exact_steps:       c.exact_steps,
    entity_type:       c.entity_type,
    entity_ids:        c.entity_ids,
    estimated_minutes: c.estimated_minutes,
    proof_type:        c.proof_type,
    why_now:           c.why_now,
    risk_if_ignored:   c.risk_if_ignored,
    unlocks_after:     c.unlocks_after,
    required_assets:   c.required_assets,
    phase_key:         c.phase_key,
    priority_score:    Math.round(c._score * 100) / 100,
  };
}

// ─── Bottleneck detection ─────────────────────────────────────────────────────

function _detectBottleneck({ current_phase, gates, scored, overdue, stalled }) {
  const criticalGates = gates.filter((g) => g.status === 'fail' && g.severity === 'critical');
  if (criticalGates.length) {
    return {
      label:  'Critical gate blocked',
      reason: criticalGates.map((g) => g.gate_key).join(', '),
    };
  }

  const failingGates = gates.filter((g) => g.status === 'fail');
  if (failingGates.length) {
    return {
      label:  'Phase exit blocked',
      reason: `${failingGates.length} gate(s) failing in phase ${current_phase}`,
    };
  }

  if (overdue.length > 3) {
    return { label: 'Overdue task accumulation', reason: `${overdue.length} overdue items requiring attention` };
  }

  if (stalled.length > 2) {
    return { label: 'Pipeline momentum loss', reason: `${stalled.length} entities stalled — re-engagement needed` };
  }

  if (scored.length === 0) {
    return { label: 'No actions identified', reason: 'All tracked items appear current' };
  }

  return {
    label:  scored[0]?.title ?? 'Unknown',
    reason: scored[0]?.why_now ?? 'Highest priority item',
  };
}

// ─── Overdue / stalled detection ─────────────────────────────────────────────

function _detectOverdue(tasks, deals, taskTimingMap = new Map()) {
  const now = Date.now();
  const overdueTasks = tasks
    .filter((t) => t.status !== 'done')
    .map((t) => {
      const timing = taskTimingMap.get(t.id);
      if (timing) {
        if (!['overdue', 'critical_overdue'].includes(timing.timing_state)) return null;
        return {
          type:        'task',
          id:          t.id,
          title:       t.title,
          due:         timing.due_at,
          priority:    timing.priority,
          timing_state: timing.timing_state,
          days_overdue: timing.days_overdue ?? 0,
        };
      }
      // Fallback for tasks without timing map entry
      if (!t.dueDate || new Date(t.dueDate) >= now) return null;
      return {
        type:        'task',
        id:          t.id,
        title:       t.title,
        due:         t.dueDate,
        priority:    t.priority ?? 'medium',
        timing_state: 'overdue',
        days_overdue: Math.ceil((now - new Date(t.dueDate)) / 86400000),
      };
    })
    .filter(Boolean);

  return overdueTasks.sort((a, b) => b.days_overdue - a.days_overdue);
}

function _detectStalled(deals, relationships, dealTimingMap = new Map(), relTimingMap = new Map()) {
  const stalledDeals = deals
    .filter((d) => d.stage !== 'closed' && d.stage !== 'dead')
    .map((d) => {
      const timing = dealTimingMap.get(d.id) ?? calcDealVelocityState(d);
      if (!['slow', 'critical'].includes(timing.velocity_state)) {
        // Fallback for legacy daysSinceActivity
        if ((d.daysSinceActivity ?? 0) <= 14) return null;
      }
      return {
        type:         'deal',
        id:           d.id,
        name:         d.name ?? d.companyName ?? d.id,
        stage:        timing.stage ?? d.stage,
        velocity_state: timing.velocity_state,
        days_inactive: timing.days_in_stage ?? d.daysSinceActivity ?? 0,
      };
    })
    .filter(Boolean);

  const coldRels = relationships
    .filter((r) => r.status !== 'inactive')
    .map((r) => {
      const timing = relTimingMap.get(r.id) ?? calcRelationshipState(r);
      if (!['cooling', 'stalled', 'critical'].includes(timing.timing_state)) return null;
      return {
        type:         'relationship',
        id:           r.id,
        name:         r.name ?? r.id,
        timing_state: timing.timing_state,
        days_inactive: timing.days_since_last_touch ?? r.daysSinceContact ?? 0,
      };
    })
    .filter(Boolean);

  return [...stalledDeals, ...coldRels].sort((a, b) => b.days_inactive - a.days_inactive);
}

// ─── Risk level ───────────────────────────────────────────────────────────────

function _riskLevel({ gates, overdue, stalled, scores, slaAlerts = [] }) {
  const criticalGates    = gates.filter((g) => g.status === 'fail' && g.severity === 'critical').length;
  const failingGates     = gates.filter((g) => g.status === 'fail').length;
  const overdueCount     = overdue.length;
  const stalledCount     = stalled.length;
  const criticalAlerts   = slaAlerts.filter(a => a.severity === 'critical').length;
  const highAlerts       = slaAlerts.filter(a => a.severity === 'high').length;
  const criticalOverdue  = overdue.filter(t => t.timing_state === 'critical_overdue').length;

  if (criticalGates > 0 || criticalAlerts > 0 || criticalOverdue > 0 || overdueCount > 5) return 'critical';
  if (failingGates > 2 || overdueCount > 2 || stalledCount > 3 || highAlerts > 3) return 'high';
  if (failingGates > 0 || overdueCount > 0 || stalledCount > 1 || highAlerts > 0) return 'medium';
  return 'low';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _dealValue(deal) {
  const v = deal.value ?? 0;
  if (v > 5_000_000) return 1.0;
  if (v > 2_000_000) return 0.85;
  if (v > 500_000)   return 0.65;
  return 0.45;
}

function _relValue(rel) {
  const tier = rel.tier ?? 5;
  return Math.max(0.2, 1 - (tier - 1) * 0.2);
}

function _hoursUntil(datetimeStr) {
  if (!datetimeStr) return Infinity;
  return (new Date(datetimeStr) - Date.now()) / 3600000;
}

export default { calculate, WEIGHTS };
