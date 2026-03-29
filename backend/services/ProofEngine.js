/**
 * ProofEngine — deterministic proof validation for workflow tasks.
 *
 * Rules:
 *  - Proof validation is always deterministic.
 *  - AI may never mark a task proven — only deterministic validation can.
 *  - Manual overrides require privileged role + reason on record.
 *  - Every proof result is explainable and auditable.
 */

// ─── Proof types ──────────────────────────────────────────────────────────────

export const PROOF_TYPES = {
  MESSAGE_SENT:          'message_sent',
  CALL_LOGGED:           'call_logged',
  MEETING_SCHEDULED:     'meeting_scheduled',
  MEETING_COMPLETED:     'meeting_completed',
  DOCUMENT_UPLOADED:     'document_uploaded',
  NOTE_COMPLETED:        'note_completed',
  RECORD_UPDATED:        'record_updated',
  APPROVAL_GRANTED:      'approval_granted',
  DELIVERABLE_GENERATED: 'deliverable_generated',
};

export const PROOF_STATUS = {
  PENDING:    'pending',
  PROVEN:     'proven',
  FAILED:     'failed',
  OVERRIDDEN: 'overridden',
  WAIVED:     'waived',
};

// ─── Privileged roles allowed to override proof ───────────────────────────────
const PRIVILEGED_ROLES = ['admin', 'principal', 'owner'];

// ─── Validation rules ─────────────────────────────────────────────────────────

/**
 * Validate proof for a task.
 *
 * @param {object} task    — the task requiring proof
 * @param {object} evidence — evidence records to validate against
 * @returns {ProofResult}  { status, valid, reason, evidence_summary }
 */
export function validate(task, evidence = {}) {
  const proofType = task.proof_type;
  if (!proofType) {
    return _result(PROOF_STATUS.PROVEN, true, 'No proof type required — auto-approved');
  }

  const validator = VALIDATORS[proofType];
  if (!validator) {
    return _result(PROOF_STATUS.FAILED, false, `Unknown proof type: ${proofType}`);
  }

  return validator(task, evidence);
}

// ─── Individual validators ────────────────────────────────────────────────────

const VALIDATORS = {

  [PROOF_TYPES.MESSAGE_SENT](task, evidence) {
    const { conversations = [], target_entity_id, time_window_hours = 168 } = evidence;
    const windowStart = Date.now() - time_window_hours * 3600000;
    const match = conversations.find((c) =>
      c.direction === 'outbound' &&
      (!target_entity_id || c.contact_id === target_entity_id || c.entity_id === target_entity_id) &&
      new Date(c.sent_at ?? c.created_at) >= windowStart
    );
    return match
      ? _result(PROOF_STATUS.PROVEN, true, `Outbound message found: ${match.id}`, { conversation_id: match.id })
      : _result(PROOF_STATUS.FAILED,  false, `No outbound message found for target within ${time_window_hours}h window`);
  },

  [PROOF_TYPES.CALL_LOGGED](task, evidence) {
    const { activities = [], target_entity_id } = evidence;
    const call = activities.find((a) =>
      a.type === 'call' &&
      a.outcome &&
      (!target_entity_id || a.contact_id === target_entity_id || a.entity_id === target_entity_id)
    );
    return call
      ? _result(PROOF_STATUS.PROVEN, true, `Call logged: outcome="${call.outcome}"`, { activity_id: call.id })
      : _result(PROOF_STATUS.FAILED,  false, 'No call activity with outcome found for target');
  },

  [PROOF_TYPES.MEETING_SCHEDULED](task, evidence) {
    const { meetings = [], target_entity_id } = evidence;
    const mtg = meetings.find((m) =>
      m.status !== 'cancelled' &&
      (!target_entity_id || (m.attendees ?? []).includes(target_entity_id) || m.entity_id === target_entity_id)
    );
    return mtg
      ? _result(PROOF_STATUS.PROVEN, true, `Meeting scheduled: "${mtg.title}" on ${mtg.datetime}`, { meeting_id: mtg.id })
      : _result(PROOF_STATUS.FAILED,  false, 'No scheduled (non-cancelled) meeting found for target');
  },

  [PROOF_TYPES.MEETING_COMPLETED](task, evidence) {
    const { meetings = [], target_entity_id } = evidence;
    const mtg = meetings.find((m) =>
      m.status === 'completed' &&
      m.summary &&
      (!target_entity_id || (m.attendees ?? []).includes(target_entity_id) || m.entity_id === target_entity_id)
    );
    return mtg
      ? _result(PROOF_STATUS.PROVEN, true, `Meeting completed with summary: "${mtg.title}"`, { meeting_id: mtg.id })
      : _result(PROOF_STATUS.FAILED,  false, 'No completed meeting with summary found for target');
  },

  [PROOF_TYPES.DOCUMENT_UPLOADED](task, evidence) {
    const { documents = [], required_doc_type, target_entity_id } = evidence;
    const doc = documents.find((d) =>
      (!required_doc_type || d.doc_type === required_doc_type || d.category === required_doc_type) &&
      (!target_entity_id || d.entity_id === target_entity_id || d.deal_id === target_entity_id)
    );
    return doc
      ? _result(PROOF_STATUS.PROVEN, true, `Document uploaded: "${doc.name ?? doc.id}"`, { document_id: doc.id })
      : _result(PROOF_STATUS.FAILED,  false, `Required document${required_doc_type ? ` (${required_doc_type})` : ''} not found`);
  },

  [PROOF_TYPES.NOTE_COMPLETED](task, evidence) {
    const { notes = [], target_entity_id, min_length = 50 } = evidence;
    const note = notes.find((n) =>
      n.body && n.body.length >= min_length &&
      (!target_entity_id || n.entity_id === target_entity_id)
    );
    return note
      ? _result(PROOF_STATUS.PROVEN, true, `Note completed (${note.body.length} chars)`, { note_id: note.id })
      : _result(PROOF_STATUS.FAILED,  false, `No completed note (min ${min_length} chars) found for target`);
  },

  [PROOF_TYPES.RECORD_UPDATED](task, evidence) {
    const { record, required_fields = [] } = evidence;
    if (!record) return _result(PROOF_STATUS.FAILED, false, 'Record not found');
    const missing = required_fields.filter((f) => !record[f] && record[f] !== 0);
    return missing.length === 0
      ? _result(PROOF_STATUS.PROVEN, true, `Record updated with all required fields`)
      : _result(PROOF_STATUS.FAILED, false, `Missing required fields: ${missing.join(', ')}`);
  },

  [PROOF_TYPES.APPROVAL_GRANTED](task, evidence) {
    const { approvals = [], approval_action } = evidence;
    const approval = approvals.find((a) =>
      a.status === 'approved' &&
      (!approval_action || a.action === approval_action || a.action_type === approval_action)
    );
    return approval
      ? _result(PROOF_STATUS.PROVEN, true, `Approval granted: "${approval.action ?? approval.id}"`, { approval_id: approval.id })
      : _result(PROOF_STATUS.FAILED,  false, `No approved approval record found${approval_action ? ` for action: ${approval_action}` : ''}`);
  },

  [PROOF_TYPES.DELIVERABLE_GENERATED](task, evidence) {
    const { artifacts = [], required_artifact_type, target_entity_id } = evidence;
    const artifact = artifacts.find((a) =>
      a.source_refs?.length > 0 &&
      (!required_artifact_type || a.artifact_type === required_artifact_type || a.type === required_artifact_type) &&
      (!target_entity_id || a.entity_id === target_entity_id)
    );
    return artifact
      ? _result(PROOF_STATUS.PROVEN, true, `Deliverable generated: "${artifact.title ?? artifact.id}"`, { artifact_id: artifact.id })
      : _result(PROOF_STATUS.FAILED,  false, `No deliverable${required_artifact_type ? ` of type ${required_artifact_type}` : ''} with source refs found`);
  },
};

// ─── Manual override ──────────────────────────────────────────────────────────

/**
 * Apply a privileged manual override to a task's proof status.
 * Returns an override record — caller must persist it.
 *
 * @param {object} params
 * @param {string}  params.task_id
 * @param {string}  params.overriding_user_id
 * @param {string}  params.overriding_user_role
 * @param {string}  params.reason             — required; min 20 chars
 * @param {string}  [params.override_to]      — default: 'waived'
 * @returns {{ allowed, override_record } | { allowed, error }}
 */
export function applyOverride({ task_id, overriding_user_id, overriding_user_role, reason, override_to = PROOF_STATUS.WAIVED }) {
  if (!PRIVILEGED_ROLES.includes(overriding_user_role)) {
    return { allowed: false, error: `Role "${overriding_user_role}" is not permitted to override proof. Required: ${PRIVILEGED_ROLES.join(', ')}` };
  }

  if (!reason || reason.trim().length < 20) {
    return { allowed: false, error: 'Override reason required (min 20 characters)' };
  }

  if (!Object.values(PROOF_STATUS).includes(override_to)) {
    return { allowed: false, error: `Invalid override_to status: ${override_to}` };
  }

  return {
    allowed: true,
    override_record: {
      task_id,
      override_status:     override_to,
      overriding_user_id,
      overriding_user_role,
      reason:              reason.trim(),
      overridden_at:       new Date().toISOString(),
    },
  };
}

// ─── Bulk proof check ─────────────────────────────────────────────────────────

/**
 * Check proof status for a list of tasks.
 * Returns summary with per-task results.
 */
export function checkBulk(tasks = [], evidenceMap = {}) {
  const results = tasks.map((task) => {
    if (task.proof_status === PROOF_STATUS.PROVEN || task.proof_status === PROOF_STATUS.WAIVED) {
      return { task_id: task.id, ...task.proof_status === PROOF_STATUS.PROVEN
        ? _result(PROOF_STATUS.PROVEN, true, 'Previously proven')
        : _result(PROOF_STATUS.WAIVED, true, 'Previously waived') };
    }
    const evidence = evidenceMap[task.id] ?? {};
    return { task_id: task.id, ...validate(task, evidence) };
  });

  const proven  = results.filter((r) => r.valid).length;
  const failing = results.filter((r) => !r.valid);

  return {
    total:         tasks.length,
    proven,
    failing_count: failing.length,
    completion_rate: tasks.length > 0 ? Math.round((proven / tasks.length) * 100) : 100,
    results,
    gaps: failing.map((r) => ({ task_id: r.task_id, reason: r.reason })),
  };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function _result(status, valid, reason, evidence_summary = {}) {
  return { status, valid, reason, evidence_summary, validated_at: new Date().toISOString() };
}

export default { PROOF_TYPES, PROOF_STATUS, validate, applyOverride, checkBulk };
