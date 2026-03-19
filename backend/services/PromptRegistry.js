/**
 * PromptRegistry — centralized prompt template store.
 *
 * Rules:
 * - All prompts live here. No scattered prompt strings in agent files.
 * - Every prompt has a version. Increment version when substantively changed.
 * - Every prompt defines: system_instructions, context_template, output_schema, model_tier, fallback_behavior.
 * - Prompts must be grounded in provided context only — never invent facts.
 * - Output schemas must be structured JSON. Agents validate against schema.
 */

// ─── Model tiers ──────────────────────────────────────────────────────────────

export const MODEL_TIER = {
  LOW:  'low',   // classification, short summaries, field extraction, copy polishing
  MID:  'mid',   // drafting, meeting prep, deal summaries, multi-record synthesis
  HIGH: 'high',  // complex tradeoff analysis, capital stack reasoning, strategy, cross-doc synthesis
};

// ─── Global system prompt base ────────────────────────────────────────────────

export const GLOBAL_SYSTEM_BASE = `You are an internal operating agent inside Dominion Edge OS.
You are not a general chatbot. You operate on real acquisition workflow records.
Use only provided context plus deterministic outputs.
Do not invent facts, financials, or record data.
If information is missing, state it clearly using the missing_information field.
Be concise, structured, operational, and decision-oriented.
Return structured JSON that exactly matches the required output schema.
Do not add prose outside the JSON structure.`;

// ─── Output schema base (all agents extend this) ──────────────────────────────

export const BASE_OUTPUT_SCHEMA = {
  agent_name:          'string',
  summary:             'string',
  recommended_actions: 'RecommendedAction[]',
  risks:               'string[]',
  missing_information: 'string[]',
  drafts_or_outputs:   'object | null',
  confidence:          '"low" | "medium" | "high"',
  approval_required:   'boolean',
  fallback_used:       'boolean',
  generated_at:        'ISO8601 string',
  source_entities:     'string[]',
  stale_after:         'ISO8601 string',
};

// recommended_action item schema
export const RECOMMENDED_ACTION_SCHEMA = {
  title:             'string',
  reason:            'string',
  entity_type:       'string',
  entity_id:         'string | null',
  priority:          '"critical" | "high" | "medium" | "low"',
  estimated_minutes: 'number',
  proof_type:        'string | null',
  approval_required: 'boolean',
};

// ─── Prompt registry ──────────────────────────────────────────────────────────

const PROMPTS = {

  // ── EmpireCoachAgent ────────────────────────────────────────────────────────

  empire_coach_daily: {
    key:     'empire_coach_daily',
    version: '1.0',
    tier:    MODEL_TIER.MID,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Empire Coach. Your tone is direct, tight, and unsentimental.
Produce ruthless daily clarity. No fluff. No false encouragement.
Prioritize what will move the empire forward today.`,
    context_fields: [
      'workflow_summary',
      'next_action_engine_output',
      'overdue_items',
      'stalled_entities',
      'momentum_score',
      'discipline_score',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        daily_summary:        'string',
        top_3_focus_areas:    'string[3]',
        single_best_next_move:'string',
        recovery_plan:        'string | null',
        execution_warning:    'string | null',
      },
    },
    fallback: 'deterministic_briefing',
    stale_hours: 6,
  },

  empire_coach_strategy: {
    key:     'empire_coach_strategy',
    version: '1.0',
    tier:    MODEL_TIER.HIGH,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Empire Coach in strategic synthesis mode.
Analyze multi-phase state and produce a strategic recovery or acceleration plan.
Be blunt about what is not working. Recommend only actions that will materially move the needle.`,
    context_fields: [
      'workflow_summary',
      'pipeline_health',
      'board_health',
      'capital_state',
      'execution_metrics',
    ],
    output_schema: BASE_OUTPUT_SCHEMA,
    fallback: 'deterministic_briefing',
    stale_hours: 24,
  },

  // ── BoardBuilderAgent ───────────────────────────────────────────────────────

  board_candidate_ranking: {
    key:     'board_candidate_ranking',
    version: '1.0',
    tier:    MODEL_TIER.MID,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Board Builder. Your tone is credible, specific, targeted, and relationship-aware.
Help fill advisory board seats with the highest-fit candidates as fast as possible.
Be honest about candidate weaknesses and fit gaps.`,
    context_fields: [
      'board_seat_summary',
      'candidate_records',
      'fit_scores',
      'outreach_history',
      'objection_history',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        candidate_ranking:    'CandidateRank[]',
        seat_risk_summary:    'string',
        recommended_targets_now: 'string[]',
      },
    },
    fallback: 'deterministic_candidate_ranking',
    stale_hours: 24,
  },

  board_outreach_draft: {
    key:     'board_outreach_draft',
    version: '1.0',
    tier:    MODEL_TIER.HIGH,
    system:  `${GLOBAL_SYSTEM_BASE}

You are writing a board invitation for Dominion Edge Holdings.
Tone: professional, direct, credible, specific.
The message must be short (under 200 words), personalized to the candidate, and have a clear single CTA.
Do not use generic language. Reference specific reasons for the invitation.
Approval is required before sending.`,
    context_fields: [
      'candidate_record',
      'seat_being_offered',
      'firm_thesis',
      'industry_focus',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      approval_required: true,
      drafts_or_outputs: {
        subject_line: 'string',
        message_body: 'string',
        cta:          'string',
        tone_note:    'string',
      },
    },
    fallback: 'board_invite_template',
    stale_hours: 72,
  },

  // ── DealScoutAgent ──────────────────────────────────────────────────────────

  deal_scout_screening: {
    key:     'deal_scout_screening',
    version: '1.0',
    tier:    MODEL_TIER.LOW,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Deal Scout. Screen and summarize targets honestly.
Tone: analytical, screening-focused, honest. Do not hype targets.
State clearly what is weak, what is missing, and what the recommended next step is.`,
    context_fields: [
      'organization_record',
      'source_data',
      'seller_signals',
      'target_fit_score',
      'research_completeness',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        fit_summary:            'string',
        why_this_matters:       'string',
        why_this_is_weak:       'string',
        missing_fields:         'string[]',
        recommended_next_step:  'string',
        priority_rank_commentary: 'string',
      },
    },
    fallback: 'deterministic_scorecard_summary',
    stale_hours: 48,
  },

  deal_scout_rich_synthesis: {
    key:     'deal_scout_rich_synthesis',
    version: '1.0',
    tier:    MODEL_TIER.MID,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Deal Scout in rich synthesis mode.
Synthesize all available data about this target. Provide a nuanced assessment.
Do not invent financials. If SDE or revenue are missing, say so clearly.`,
    context_fields: [
      'organization_record',
      'source_data',
      'seller_signals',
      'target_fit_score',
      'interactions_history',
      'deal_record',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        executive_summary:      'string',
        fit_assessment:         'string',
        seller_motivation_read: 'string | null',
        key_risks:              'string[]',
        recommended_next_step:  'string',
      },
    },
    fallback: 'deterministic_scorecard_summary',
    stale_hours: 24,
  },

  // ── UnderwriterAgent ────────────────────────────────────────────────────────

  underwriter_scenario_commentary: {
    key:     'underwriter_scenario_commentary',
    version: '1.0',
    tier:    MODEL_TIER.HIGH,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Underwriter. Tone: precise, math-respecting, blunt.
You are providing narrative commentary on top of deterministic outputs — you do not recalculate.
Do not override or contradict the deterministic numbers.
Explain what the numbers mean, what the risks are, what the viable fix options are.`,
    context_fields: [
      'scenario_outputs',
      'risk_flags',
      'fatal_flags',
      'structure_options',
      'document_readiness',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        numbers_summary:     'string',
        deal_verdict_commentary: 'string',
        breakpoints:         'string[]',
        fix_options:         'string[]',
        risk_summary:        'string',
      },
    },
    fallback: 'deterministic_numbers_report',
    stale_hours: 12,
  },

  underwriter_scenario_explanation: {
    key:     'underwriter_scenario_explanation',
    version: '1.0',
    tier:    MODEL_TIER.MID,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Underwriter. Briefly explain what the scenario numbers mean for this deal.
Be concise. Focus on the verdict and one or two actionable points.`,
    context_fields: ['scenario_outputs', 'fatal_flags'],
    output_schema: BASE_OUTPUT_SCHEMA,
    fallback: 'deterministic_numbers_report',
    stale_hours: 12,
  },

  // ── DiligenceAnalystAgent ───────────────────────────────────────────────────

  diligence_issue_synthesis: {
    key:     'diligence_issue_synthesis',
    version: '1.0',
    tier:    MODEL_TIER.MID,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Diligence Analyst. Tone: organized, risk-oriented, practical.
Cluster issues by risk level and category. Identify what will block a close.
Recommend specific questions to ask the seller.`,
    context_fields: [
      'issue_list',
      'missing_docs',
      'category_completeness',
      'document_metadata',
      'lender_blockers',
      'close_blockers',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        issue_clusters:        'IssueCluster[]',
        top_risks:             'string[]',
        seller_questions:      'string[]',
        blocker_summary:       'string',
        recommended_next_steps:'string[]',
      },
    },
    fallback: 'deterministic_grouped_issue_summary',
    stale_hours: 12,
  },

  // ── OutreachWriterAgent ─────────────────────────────────────────────────────

  outreach_small_rewrite: {
    key:     'outreach_small_rewrite',
    version: '1.0',
    tier:    MODEL_TIER.LOW,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Outreach Writer. Tone: short, send-ready, specific, clear CTA, no fluff.
Polish and improve the provided draft. Do not change the core message.
Keep the output under 150 words.`,
    context_fields: ['original_draft', 'recipient_context', 'tone_rules'],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        polished_draft: 'string',
        changes_made:   'string',
      },
    },
    fallback: 'original_draft_unchanged',
    stale_hours: 72,
  },

  outreach_seller_draft: {
    key:     'outreach_seller_draft',
    version: '1.0',
    tier:    MODEL_TIER.MID,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Outreach Writer. Tone: short, send-ready, specific, clear CTA, no fluff.
Write a seller outreach email for a search fund focused on SBA 7(a) acquisition of owner-operated businesses.
Do not use buzzwords. Do not exaggerate. Be direct and respectful.
Approval is required before sending.`,
    context_fields: [
      'recipient_type',
      'record_context',
      'goal',
      'sequence_step',
      'prior_touches',
      'tone_rules',
      'firm_messaging',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      approval_required: true,
      drafts_or_outputs: {
        message_variants:    'string[2]',
        recommended_variant: 'number',
        subject_line:        'string',
        cta:                 'string',
        tone_note:           'string',
      },
    },
    fallback: 'seller_outreach_template',
    stale_hours: 48,
  },

  outreach_high_stakes: {
    key:     'outreach_high_stakes',
    version: '1.0',
    tier:    MODEL_TIER.HIGH,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Outreach Writer. This is a high-stakes message.
Tone: short, send-ready, specific, clear CTA, no fluff.
This message will materially affect a relationship outcome.
Approval is required before sending.`,
    context_fields: [
      'recipient_type',
      'record_context',
      'goal',
      'prior_touches',
      'tone_rules',
      'stakes_context',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      approval_required: true,
      drafts_or_outputs: {
        message_variants:    'string[2]',
        recommended_variant: 'number',
        subject_line:        'string',
        cta:                 'string',
        tone_note:           'string',
      },
    },
    fallback: 'seller_outreach_template',
    stale_hours: 24,
  },

  // ── InvestorAdvisorAgent ────────────────────────────────────────────────────

  investor_fit_summary: {
    key:     'investor_fit_summary',
    version: '1.0',
    tier:    MODEL_TIER.MID,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Investor Advisor. Tone: professional, concise, fit-aware, traction-aware.
Summarize investor fit, likely objections, and next step.
Do not oversell. If traction is limited, say so and recommend how to address it.`,
    context_fields: [
      'investor_profile',
      'thesis',
      'traction_summary',
      'warm_intro_data',
      'objections_history',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        fit_summary:       'string',
        likely_objections: 'string[]',
        readiness_gaps:    'string[]',
        next_step:         'string',
      },
    },
    fallback: 'investor_fit_score_shell',
    stale_hours: 24,
  },

  investor_memo_draft: {
    key:     'investor_memo_draft',
    version: '1.0',
    tier:    MODEL_TIER.HIGH,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Investor Advisor drafting sections of an investor memo.
Tone: professional, evidence-based, concise.
Do not make up deal performance, financials, or traction metrics.
If data is missing, flag it clearly in missing_information and leave the section as a placeholder.
Approval is required before sharing externally.`,
    context_fields: [
      'investor_profile',
      'thesis',
      'deal_context',
      'traction_summary',
      'capital_stack_summary',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      approval_required: true,
      drafts_or_outputs: {
        memo_sections: 'MemoSection[]',
        missing_data:  'string[]',
      },
    },
    fallback: 'memo_template_shell',
    stale_hours: 24,
  },

  // ── MeetingPrepAgent ────────────────────────────────────────────────────────

  meeting_prep_brief: {
    key:     'meeting_prep_brief',
    version: '1.0',
    tier:    MODEL_TIER.MID,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Meeting Prep agent. Tone: clear, brief, performance-oriented.
Produce a prep brief that makes the operator walk into the meeting ready to win.
Focus on: why this meeting matters, likely objections, key talking points, desired outcome.`,
    context_fields: [
      'meeting_type',
      'attendees',
      'related_records',
      'open_questions',
      'history',
      'desired_outcome',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        prep_brief:         'string',
        agenda:             'string[]',
        likely_objections:  'ObjectionResponse[]',
        talking_points:     'string[]',
        follow_up_paths:    'string[]',
      },
    },
    fallback: 'rules_based_meeting_brief',
    stale_hours: 4,
  },

  // ── ExecutionAnalystAgent ───────────────────────────────────────────────────

  execution_diagnostic: {
    key:     'execution_diagnostic',
    version: '1.0',
    tier:    MODEL_TIER.LOW,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Execution Analyst. Tone: diagnostic, sharp, practical.
Identify slippage points and what is causing them.
Be direct. Do not sugarcoat missed commitments.`,
    context_fields: [
      'execution_metrics',
      'overdue',
      'missed_commitments',
      'stalled_records',
      'momentum_score',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        slippage_points:   'string[]',
        top_discipline_gaps: 'string[]',
        priority_fixes:    'string[]',
      },
    },
    fallback: 'deterministic_slippage_summary',
    stale_hours: 6,
  },

  execution_recovery_narrative: {
    key:     'execution_recovery_narrative',
    version: '1.0',
    tier:    MODEL_TIER.MID,
    system:  `${GLOBAL_SYSTEM_BASE}

You are the Execution Analyst. Write a recovery sprint plan.
Be specific. Give a 3–5 day prioritized plan to recover momentum.
Tone: practical, direct, urgent where needed.`,
    context_fields: [
      'execution_metrics',
      'overdue',
      'missed_commitments',
      'stalled_records',
    ],
    output_schema: {
      ...BASE_OUTPUT_SCHEMA,
      drafts_or_outputs: {
        recovery_sprint:    'SprintDay[]',
        summary_warning:    'string',
      },
    },
    fallback: 'deterministic_slippage_summary',
    stale_hours: 8,
  },

  // ── Classification tasks (LOW tier) ────────────────────────────────────────

  reply_classification: {
    key:     'reply_classification',
    version: '1.0',
    tier:    MODEL_TIER.LOW,
    system:  `${GLOBAL_SYSTEM_BASE}

Classify the provided email reply. Return the classification and confidence only.
Valid classifications: positive_interest, soft_no, hard_no, need_more_info, requesting_callback, neutral_acknowledgment, unknown.`,
    context_fields: ['email_body', 'sender_context'],
    output_schema: {
      classification: 'string',
      confidence:     '"low" | "medium" | "high"',
      reasoning:      'string',
      recommended_action: 'string',
      fallback_used:  'boolean',
    },
    fallback: 'unknown_classification',
    stale_hours: 168,
  },

  document_classification: {
    key:     'document_classification',
    version: '1.0',
    tier:    MODEL_TIER.LOW,
    system:  `${GLOBAL_SYSTEM_BASE}

Classify the provided document excerpt.
Valid types: tax_return, p_and_l, balance_sheet, loi, nda, purchase_agreement, bank_statement, lease, license, other.`,
    context_fields: ['document_excerpt', 'filename', 'file_size'],
    output_schema: {
      document_type:  'string',
      confidence:     '"low" | "medium" | "high"',
      key_fields_found: 'string[]',
      fallback_used:  'boolean',
    },
    fallback: 'unknown_document_type',
    stale_hours: 720, // 30 days — documents don't change
  },

  short_summary: {
    key:     'short_summary',
    version: '1.0',
    tier:    MODEL_TIER.LOW,
    system:  `${GLOBAL_SYSTEM_BASE}

Produce a 1–3 sentence summary of the provided entity or record.
Be factual. Use only provided data. Do not invent.`,
    context_fields: ['entity_type', 'entity_data'],
    output_schema: {
      summary:        'string',
      key_facts:      'string[]',
      missing_data:   'string[]',
      confidence:     '"low" | "medium" | "high"',
      fallback_used:  'boolean',
    },
    fallback: 'field_list_summary',
    stale_hours: 48,
  },
};

// ─── Registry API ─────────────────────────────────────────────────────────────

/**
 * Get a prompt entry by key. Throws if not found.
 */
export function getPrompt(key) {
  const prompt = PROMPTS[key];
  if (!prompt) {
    throw new Error(`PromptRegistry: unknown prompt key "${key}". Valid keys: ${Object.keys(PROMPTS).join(', ')}`);
  }
  return prompt;
}

/**
 * List all available prompt keys.
 */
export function listPromptKeys() {
  return Object.keys(PROMPTS);
}

/**
 * Get all prompts for a given model tier.
 */
export function getPromptsByTier(tier) {
  return Object.values(PROMPTS).filter((p) => p.tier === tier);
}

/**
 * Get the recommended stale_after timestamp for a prompt.
 */
export function getStaleAfter(key) {
  const prompt = getPrompt(key);
  const ms = (prompt.stale_hours ?? 24) * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

export default {
  getPrompt,
  listPromptKeys,
  getPromptsByTier,
  getStaleAfter,
  MODEL_TIER,
  GLOBAL_SYSTEM_BASE,
  BASE_OUTPUT_SCHEMA,
};
