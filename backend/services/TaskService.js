/**
 * TaskService — Deterministic task logic. No AI calls.
 *
 * Handles: task creation rules, priority assignment, due date calculation,
 * meeting prep/follow-up task templates, overdue detection, dependency
 * resolution, proof linkage, blocking gate associations, and origin tracking.
 *
 * Task object shape (full):
 * {
 *   id, title, taskType, status, priority, dueDate,
 *   is_required,           // boolean — workflow gate depends on this
 *   phase_key,             // which workflow phase this task belongs to
 *   dependency_ids,        // task IDs that must complete first
 *   blocking_gate_keys,    // WorkflowEngine gate keys this task satisfies
 *   proof_type,            // from ProofEngine.PROOF_TYPES
 *   proof_status,          // from ProofEngine.PROOF_STATUS
 *   proof_evidence,        // snapshot of evidence used for proof
 *   origin_system,         // see ORIGIN_SYSTEMS
 *   origin_entity_type,    // e.g. 'deal', 'meeting', 'sequence_step'
 *   origin_entity_id,
 *   completion_quality,    // optional: 'high' | 'medium' | 'low'
 *   override_reason,       // populated on privileged override
 * }
 */

import { PROOF_STATUS } from './ProofEngine.js';

// ─── Origin systems ───────────────────────────────────────────────────────────
export const ORIGIN_SYSTEMS = {
  WORKFLOW_ENGINE:   'workflow_engine',
  NEXT_ACTION_ENGINE:'next_action_engine',
  SEQUENCE_ENGINE:   'sequence_engine',
  MEETING_ENGINE:    'meeting_engine',
  DILIGENCE_ENGINE:  'diligence_engine',
  MANUAL_USER:       'manual_user',
};

// ─── Priority rules (deterministic) ──────────────────────────────────────────
export function assignPriority({ dueDate, linkedDealStage, taskType }) {
  if (taskType === 'loi_deadline' || taskType === 'closing_task') return 'critical';

  if (dueDate) {
    const daysUntil = (new Date(dueDate) - Date.now()) / 86400000;
    if (daysUntil <= 1)  return 'critical';
    if (daysUntil <= 3)  return 'high';
    if (daysUntil <= 7)  return 'medium';
  }

  const stageMap = {
    loi_accepted:      'critical',
    due_diligence:     'high',
    loi_submitted:     'high',
    nda_signed:        'medium',
    conversation:      'medium',
    interested:        'medium',
  };
  if (linkedDealStage && stageMap[linkedDealStage]) return stageMap[linkedDealStage];

  return 'low';
}

// ─── Due date calculation (deterministic) ────────────────────────────────────
export function calculateDueDate(taskType, referenceDate) {
  const base = new Date(referenceDate || Date.now());
  const offsets = {
    meeting_prep:           -1,   // 1 day before meeting
    meeting_followup:        1,   // 1 day after meeting
    loi_followup:            3,
    nda_followup:            2,
    intro_followup:          7,
    weekly_review:           7,
    diligence_request:       5,
    default:                 7,
  };
  const days = offsets[taskType] ?? offsets.default;
  return new Date(base.getTime() + days * 86400000).toISOString();
}

// ─── Meeting task templates (deterministic) ───────────────────────────────────
const PREP_TEMPLATES = {
  seller_discovery:           { title: 'Prep: seller discovery call', items: ['Research company revenue signals', 'Review LinkedIn profile', 'Prepare 3 qualification questions', 'Confirm call details'] },
  seller_followup:            { title: 'Prep: seller follow-up call', items: ['Review prior call notes', 'Prepare updated valuation range', 'Draft follow-up agenda'] },
  board_intro:                { title: 'Prep: board candidate intro', items: ['Research candidate background', 'Prepare board compensation discussion', 'Review board composition gaps'] },
  diligence_review:           { title: 'Prep: diligence review session', items: ['Prepare QofE questions', 'Review prior financial submissions', 'Confirm NDA executed'] },
  capital_intro:              { title: 'Prep: capital partner intro', items: ['Prepare investor deck', 'Review deal terms', 'Confirm wire instructions'] },
  banker_intro:               { title: 'Prep: banker/intermediary intro', items: ['Research firm recent transactions', 'Prepare buyer criteria summary'] },
  default:                    { title: 'Prep: upcoming meeting', items: ['Review agenda', 'Prepare notes and questions'] },
};

const FOLLOWUP_TEMPLATES = {
  seller_discovery:           { title: 'Follow-up: seller discovery call', items: ['Send thank-you note within 24h', 'Update CRM with call notes', 'Decide: pass, follow-up, or NDA'] },
  seller_followup:            { title: 'Follow-up: seller follow-up', items: ['Send LOI or decline within 48h', 'Update deal stage in pipeline'] },
  diligence_review:           { title: 'Follow-up: diligence session', items: ['Document open items', 'Send diligence request list', 'Update underwriting model'] },
  board_intro:                { title: 'Follow-up: board intro', items: ['Send formal board invitation if positive', 'Update board tracker'] },
  default:                    { title: 'Follow-up: meeting', items: ['Send follow-up email within 24h', 'Update CRM'] },
};

export function createPrepTask({ meetingType, meetingTitle, meetingId, startsAt, companyId, linkedDealId }) {
  const tpl = PREP_TEMPLATES[meetingType] || PREP_TEMPLATES.default;
  return {
    title: `${tpl.title}: ${meetingTitle}`,
    taskType: 'meeting_prep',
    priority: assignPriority({ dueDate: calculateDueDate('meeting_prep', startsAt), taskType: 'meeting_prep' }),
    dueDate: calculateDueDate('meeting_prep', startsAt),
    checklistItems: tpl.items,
    linkedMeetingId: meetingId,
    linkedCompanyId: companyId || null,
    linkedDealId: linkedDealId || null,
    status: 'todo',
  };
}

export function createFollowUpTask({ meetingType, meetingTitle, meetingId, endsAt, companyId, linkedDealId }) {
  const tpl = FOLLOWUP_TEMPLATES[meetingType] || FOLLOWUP_TEMPLATES.default;
  return {
    title: `${tpl.title}: ${meetingTitle}`,
    taskType: 'meeting_followup',
    priority: assignPriority({ dueDate: calculateDueDate('meeting_followup', endsAt), taskType: 'meeting_followup' }),
    dueDate: calculateDueDate('meeting_followup', endsAt),
    checklistItems: tpl.items,
    linkedMeetingId: meetingId,
    linkedCompanyId: companyId || null,
    linkedDealId: linkedDealId || null,
    status: 'todo',
  };
}

// ─── Overdue detection (deterministic) ────────────────────────────────────────
export function detectOverdue(tasks) {
  const now = Date.now();
  return tasks
    .filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate).getTime() < now)
    .map((t) => ({
      ...t,
      daysOverdue: Math.round((now - new Date(t.dueDate).getTime()) / 86400000),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// ─── Dependency resolution ────────────────────────────────────────────────────

/**
 * Check if a task's dependencies are all met.
 * Returns { ready, blocked_by }
 */
export function checkDependencies(task, allTasks = []) {
  if (!task.dependency_ids?.length) return { ready: true, blocked_by: [] };

  const taskMap = Object.fromEntries(allTasks.map((t) => [t.id, t]));
  const blocked = task.dependency_ids.filter((depId) => {
    const dep = taskMap[depId];
    return !dep || dep.status !== 'done';
  });

  return { ready: blocked.length === 0, blocked_by: blocked };
}

/**
 * Return all tasks that are blocked from starting due to unmet dependencies.
 */
export function detectBlocked(tasks = []) {
  return tasks
    .filter((t) => t.status !== 'done')
    .map((t) => ({ ...t, _deps: checkDependencies(t, tasks) }))
    .filter((t) => !t._deps.ready)
    .map(({ _deps, ...t }) => ({ ...t, blocked_by: _deps.blocked_by }));
}

/**
 * Create a workflow-engine-originated required task.
 * Includes all proof + gate linkage fields.
 */
export function createWorkflowTask({
  title, taskType, phaseKey, blockingGateKeys = [], proofType = null,
  dependencyIds = [], dueDate = null, originEntityType = null, originEntityId = null,
}) {
  return {
    title,
    taskType,
    status:              'todo',
    is_required:         true,
    phase_key:           phaseKey,
    dependency_ids:      dependencyIds,
    blocking_gate_keys:  blockingGateKeys,
    proof_type:          proofType,
    proof_status:        PROOF_STATUS.PENDING,
    origin_system:       ORIGIN_SYSTEMS.WORKFLOW_ENGINE,
    origin_entity_type:  originEntityType,
    origin_entity_id:    originEntityId,
    priority:            'high',
    dueDate:             dueDate ?? calculateDueDate(taskType, new Date().toISOString()),
    completion_quality:  null,
    override_reason:     null,
  };
}

/**
 * Create a sequence-engine-originated outreach task.
 */
export function createSequenceTask({
  title, taskType, phaseKey, proofType, sequenceKey, stepNumber,
  targetEntityType, targetEntityId, dueDate = null,
}) {
  return {
    title,
    taskType,
    status:              'todo',
    is_required:         false,
    phase_key:           phaseKey,
    dependency_ids:      [],
    blocking_gate_keys:  [],
    proof_type:          proofType,
    proof_status:        PROOF_STATUS.PENDING,
    origin_system:       ORIGIN_SYSTEMS.SEQUENCE_ENGINE,
    origin_entity_type:  targetEntityType,
    origin_entity_id:    targetEntityId,
    sequence_key:        sequenceKey,
    sequence_step:       stepNumber,
    priority:            assignPriority({ dueDate, taskType }),
    dueDate:             dueDate ?? calculateDueDate(taskType, new Date().toISOString()),
    completion_quality:  null,
    override_reason:     null,
  };
}

/**
 * Mark a task as complete. Returns updated task — caller must persist.
 * Validates that proof_status is proven or waived before allowing completion.
 */
export function completeTask(task, { quality = null, notes = null } = {}) {
  if (task.is_required && task.proof_type) {
    const provenStatuses = [PROOF_STATUS.PROVEN, PROOF_STATUS.WAIVED, PROOF_STATUS.OVERRIDDEN];
    if (!provenStatuses.includes(task.proof_status)) {
      return {
        success: false,
        error: `Required task "${task.title}" cannot be completed — proof_status is "${task.proof_status}". Submit proof first.`,
        task,
      };
    }
  }

  return {
    success: true,
    task: {
      ...task,
      status:             'done',
      completed_at:       new Date().toISOString(),
      completion_quality: quality,
      completion_notes:   notes,
    },
  };
}

export const TaskService = {
  assignPriority, calculateDueDate,
  createPrepTask, createFollowUpTask, createWorkflowTask, createSequenceTask,
  detectOverdue, detectBlocked, checkDependencies, completeTask,
  ORIGIN_SYSTEMS,
};
export default TaskService;
