/**
 * TaskService — Deterministic task logic. No AI calls.
 *
 * Handles: task creation rules, priority assignment, due date calculation,
 * meeting prep/follow-up task templates, overdue detection.
 */

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

export const TaskService = { assignPriority, calculateDueDate, createPrepTask, createFollowUpTask, detectOverdue };
export default TaskService;
