/**
 * AgentOutputSchema — strict shared output schemas and validators for all agents.
 *
 * Rules:
 *  - All agent outputs must match a known schema.
 *  - Validators are deterministic — no AI involvement.
 *  - On schema failure: caller retries once with repair prompt, then uses fallback.
 *  - Never return malformed raw text to business logic.
 */

// ─── Severity / priority constants ───────────────────────────────────────────

export const RISK_SEVERITY   = ['info', 'watch', 'material', 'critical', 'fatal'];
export const ACTION_PRIORITY = ['critical', 'high', 'medium', 'low'];
export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];

// ─── Base schema definition ───────────────────────────────────────────────────

export const BASE_AGENT_SCHEMA = {
  agent_name:           'string',
  summary:              'string',           // 1–4 sentences, operational
  recommended_actions:  'Action[]',
  risks:                'Risk[]',
  missing_information:  'string[]',
  drafts_or_outputs:    'object|null',
  confidence:           'low|medium|high',
  approval_required:    'boolean',
  fallback_used:        'boolean',
  generated_at:         'ISO8601',
  source_entities:      'SourceEntity[]',
  stale_after:          'ISO8601',
  source_snapshot_hash: 'string',
};

// ─── Agent-specific drafts_or_outputs schemas ────────────────────────────────

export const AGENT_OUTPUT_SCHEMAS = {
  EmpireCoachAgent: {
    daily_focus:              'string',
    top_3_actions:            'Action[]',
    single_best_next_action:  {
      title:             'string',
      why_now:           'string',
      exact_steps:       'string[]',
      estimated_minutes: 'number',
      proof_required:    'string',
      unlocks_after:     'string',
      risk_if_ignored:   'string',
    },
    recovery_plan:            'string|null',
    execution_warning:        'string|null',
  },

  BoardBuilderAgent: {
    candidate_rankings:   [{
      candidate_id:         'string',
      seat_type:            'string',
      fit_score:            'number',
      why_this_candidate:   'string',
      urgency:              'string',
      recommended_next_step:'string',
    }],
    seat_risk_summary:    'string',
    recommended_outreach: [{
      candidate_id:   'string',
      variant_name:   'string',
      subject:        'string|null',
      body:           'string',
      cta:            'string',
      approval_required: 'boolean',
    }],
    objection_handling:   [{
      objection_key:         'string',
      recommended_response:  'string',
      tone_note:             'string',
    }],
    meeting_prep:         'string|null',
  },

  DealScoutAgent: {
    fit_summary:               'string',
    strengths:                 'string[]',
    weaknesses:                'string[]',
    missing_fields:            'string[]',
    priority_rank_commentary:  'string',
    recommended_next_step:     'string',
  },

  UnderwriterAgent: {
    numbers_summary:   'string',
    deal_verdict:      'go|conditional_go|no_go',
    breakpoints:       [{
      factor:         'string',
      current_state:  'string',
      required_state: 'string',
      severity:       'string',
    }],
    fix_options:       [{
      action:      'string',
      impact:      'string',
      likelihood:  'string',
      notes:       'string|null',
    }],
    risk_summary:      'string',
    scenario_commentary: 'string|null',
  },

  DiligenceAnalystAgent: {
    issue_clusters:       [{
      cluster_key:   'string',
      label:         'string',
      severity:      'string',
      issue_ids:     'string[]',
      summary:       'string',
    }],
    missing_docs:         'string[]',
    seller_questions:     [{
      question:         'string',
      reason:           'string',
      linked_issue_ids: 'string[]',
    }],
    lender_blockers:      'string[]',
    close_blockers:       'string[]',
    recommended_next_steps: 'string[]',
  },

  OutreachWriterAgent: {
    message_variants:    [{
      variant_name:     'string',
      channel:          'string',
      subject:          'string|null',
      body:             'string',
      tone:             'string',
      approval_required:'boolean',
    }],
    recommended_variant: 'string',
    subject_lines:       'string[]|null',
    cta:                 'string',
    tone_notes:          'string',
  },

  InvestorAdvisorAgent: {
    fit_summary:     'string',
    memo_sections:   'object',
    likely_objections: 'string[]',
    next_step:       'string',
    readiness_gaps:  'string[]',
    message_draft:   'string|null',
  },

  MeetingPrepAgent: {
    prep_brief: {
      meeting_goal:              'string',
      why_this_meeting_matters:  'string',
      top_3_points:              'string[]',
      key_facts:                 'string[]',
      open_questions:            'string[]',
    },
    agenda:           'string[]',
    likely_objections:'string[]',
    talking_points:   'string[]',
    desired_outcome:  'string',
    fallback_outcomes:'string[]',
    follow_up_paths:  'string[]',
  },

  ExecutionAnalystAgent: {
    slippage_points:    'string[]',
    priority_fixes:     'string[]',
    recovery_sprint:    [{
      title:           'string',
      why:             'string',
      estimated_minutes: 'number',
      proof_type:      'string',
      linked_entities: 'string[]',
    }],
    discipline_warnings:'string[]',
    weekly_focus:       'string',
  },
};

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Validate an agent output object against the base schema.
 * Returns { valid, errors, repaired }
 */
export function validateBaseSchema(output) {
  if (!output || typeof output !== 'object') {
    return { valid: false, errors: ['Output is not an object'], repaired: null };
  }

  const errors = [];

  if (typeof output.agent_name !== 'string' || !output.agent_name)    errors.push('agent_name: required string');
  if (typeof output.summary !== 'string' || !output.summary)           errors.push('summary: required string');
  if (!Array.isArray(output.recommended_actions))                       errors.push('recommended_actions: must be array');
  if (!Array.isArray(output.risks))                                     errors.push('risks: must be array');
  if (!Array.isArray(output.missing_information))                       errors.push('missing_information: must be array');
  if (!CONFIDENCE_LEVELS.includes(output.confidence))                   errors.push(`confidence: must be ${CONFIDENCE_LEVELS.join('|')}`);
  if (typeof output.approval_required !== 'boolean')                    errors.push('approval_required: must be boolean');
  if (typeof output.fallback_used !== 'boolean')                        errors.push('fallback_used: must be boolean');
  if (!_isISO(output.generated_at))                                     errors.push('generated_at: must be ISO timestamp');
  if (!_isISO(output.stale_after))                                      errors.push('stale_after: must be ISO timestamp');
  if (!Array.isArray(output.source_entities))                           errors.push('source_entities: must be array');

  // Validate action items
  if (Array.isArray(output.recommended_actions)) {
    output.recommended_actions.forEach((a, i) => {
      const ae = validateAction(a);
      if (!ae.valid) errors.push(`recommended_actions[${i}]: ${ae.errors.join(', ')}`);
    });
  }

  // Validate risk items
  if (Array.isArray(output.risks)) {
    output.risks.forEach((r, i) => {
      const re = validateRisk(r);
      if (!re.valid) errors.push(`risks[${i}]: ${re.errors.join(', ')}`);
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a recommended_action item.
 */
export function validateAction(action) {
  const errors = [];
  if (!action || typeof action !== 'object')           return { valid: false, errors: ['Not an object'] };
  if (typeof action.title !== 'string' || !action.title) errors.push('title: required');
  if (typeof action.reason !== 'string' || !action.reason) errors.push('reason: required');
  if (!ACTION_PRIORITY.includes(action.priority))      errors.push(`priority: must be ${ACTION_PRIORITY.join('|')}`);
  if (typeof action.estimated_minutes !== 'number')    errors.push('estimated_minutes: must be number');
  if (typeof action.approval_required !== 'boolean')   errors.push('approval_required: must be boolean');
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a risk item.
 */
export function validateRisk(risk) {
  const errors = [];
  if (!risk || typeof risk !== 'object')               return { valid: false, errors: ['Not an object'] };
  if (typeof risk.title !== 'string' || !risk.title)   errors.push('title: required');
  if (!RISK_SEVERITY.includes(risk.severity))          errors.push(`severity: must be ${RISK_SEVERITY.join('|')}`);
  if (typeof risk.reason !== 'string' || !risk.reason) errors.push('reason: required');
  return { valid: errors.length === 0, errors };
}

// ─── Repair / normalization ───────────────────────────────────────────────────

/**
 * Attempt to coerce a raw parsed object into a valid base schema.
 * Used after schema failure before triggering the AI retry.
 */
export function repairOutput(raw, agentName) {
  if (!raw || typeof raw !== 'object') return null;

  const now     = new Date().toISOString();
  const stale   = new Date(Date.now() + 6 * 3600_000).toISOString();

  return {
    agent_name:           raw.agent_name           ?? agentName ?? 'unknown',
    summary:              _coerceString(raw.summary ?? raw.brief ?? raw.result ?? ''),
    recommended_actions:  _coerceArray(raw.recommended_actions ?? raw.actions ?? []).map(_coerceAction),
    risks:                _coerceArray(raw.risks ?? raw.risk_factors ?? []).map(_coerceRisk),
    missing_information:  _coerceArray(raw.missing_information ?? raw.missing ?? []).map(String),
    drafts_or_outputs:    raw.drafts_or_outputs ?? raw.output ?? raw.draft ?? null,
    confidence:           CONFIDENCE_LEVELS.includes(raw.confidence) ? raw.confidence : 'low',
    approval_required:    Boolean(raw.approval_required),
    fallback_used:        Boolean(raw.fallback_used),
    generated_at:         _isISO(raw.generated_at)   ? raw.generated_at : now,
    source_entities:      _coerceArray(raw.source_entities ?? []),
    stale_after:          _isISO(raw.stale_after)     ? raw.stale_after  : stale,
    source_snapshot_hash: raw.source_snapshot_hash    ?? 'unknown',
    _repaired:            true,
  };
}

/**
 * Build the schema repair instruction for a retry prompt.
 */
export function buildRepairPrompt(rawText, errors) {
  return `Your previous response did not match the required JSON schema.

Errors found:
${errors.map((e) => `- ${e}`).join('\n')}

Your previous response:
${rawText.slice(0, 2000)}

Fix the JSON to resolve these errors. Return ONLY valid JSON. No prose before or after.`;
}

/**
 * Build an empty/safe fallback output for when all AI attempts fail.
 */
export function buildEmptyFallback(agentName, reason = 'AI unavailable') {
  const now   = new Date().toISOString();
  const stale = new Date(Date.now() + 3600_000).toISOString();
  return {
    agent_name:           agentName,
    summary:              `${agentName} output unavailable. ${reason}. Review source records directly.`,
    recommended_actions:  [],
    risks:                [{ title: 'Agent output unavailable', severity: 'watch', reason }],
    missing_information:  ['Agent output could not be generated'],
    drafts_or_outputs:    null,
    confidence:           'low',
    approval_required:    false,
    fallback_used:        true,
    generated_at:         now,
    source_entities:      [],
    stale_after:          stale,
    source_snapshot_hash: 'fallback',
  };
}

// ─── Staleness check ──────────────────────────────────────────────────────────

/**
 * Check whether an artifact or agent output is stale.
 */
export function isStale(output) {
  if (!output?.stale_after) return false;
  return new Date(output.stale_after) < new Date();
}

export function stalenessWarning(output) {
  if (!isStale(output)) return null;
  return 'This draft may be outdated because underlying records changed after generation. Review before approval.';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _isISO(s) {
  if (typeof s !== 'string') return false;
  return !isNaN(Date.parse(s));
}

function _coerceString(v) {
  if (typeof v === 'string') return v.slice(0, 1000);
  if (v && typeof v === 'object') return JSON.stringify(v).slice(0, 500);
  return String(v ?? '');
}

function _coerceArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return [v];
  return [];
}

function _coerceAction(a) {
  if (!a || typeof a !== 'object') return { title: String(a), reason: '', entity_type: 'unknown', priority: 'low', estimated_minutes: 15, approval_required: false };
  return {
    title:             a.title             ?? String(a),
    reason:            a.reason            ?? '',
    entity_type:       a.entity_type       ?? 'unknown',
    entity_id:         a.entity_id         ?? null,
    priority:          ACTION_PRIORITY.includes(a.priority) ? a.priority : 'medium',
    estimated_minutes: typeof a.estimated_minutes === 'number' ? a.estimated_minutes : 15,
    proof_type:        a.proof_type        ?? null,
    approval_required: Boolean(a.approval_required),
  };
}

function _coerceRisk(r) {
  if (!r || typeof r !== 'object') return { title: String(r), severity: 'watch', reason: '' };
  return {
    title:                  r.title     ?? String(r),
    severity:               RISK_SEVERITY.includes(r.severity) ? r.severity : 'watch',
    reason:                 r.reason    ?? '',
    entity_type:            r.entity_type ?? null,
    entity_id:              r.entity_id   ?? null,
    recommended_mitigation: r.recommended_mitigation ?? null,
  };
}

export default {
  BASE_AGENT_SCHEMA, AGENT_OUTPUT_SCHEMAS,
  RISK_SEVERITY, ACTION_PRIORITY, CONFIDENCE_LEVELS,
  validateBaseSchema, validateAction, validateRisk,
  repairOutput, buildRepairPrompt, buildEmptyFallback,
  isStale, stalenessWarning,
};
