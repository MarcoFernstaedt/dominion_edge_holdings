/**
 * WorkflowEngine — deterministic phase management for the acquisition OS.
 *
 * Rules:
 *  - Phase transitions are gated. AI never drives transitions.
 *  - Every gate returns a structured result: pass/fail + reason + fix.
 *  - readinessScore() is 0-100, always explainable.
 *  - Business logic never depends on AI availability.
 */

// ─── Phase definitions ────────────────────────────────────────────────────────

export const PHASES = {
  identity: {
    phase_key:    'identity',
    phase_label:  'Identity & Brand',
    objective:    'Establish firm identity, positioning, and foundational CRM.',
    order:        1,
    entry_requirements: ['firm_exists'],
    required_tasks: [
      'set_firm_name', 'set_principal_positioning', 'configure_brand_assets',
      'confirm_web_presence', 'enable_crm_entities', 'configure_initial_templates',
    ],
    optional_tasks: ['add_firm_bio', 'set_social_links'],
    exit_requirements: [
      'firm_name_set', 'positioning_set', 'brand_assets_configured',
      'web_presence_confirmed', 'crm_enabled', 'templates_available',
    ],
    blocking_rules: [],
    proof_rules: ['firm_name_set', 'web_presence_confirmed'],
    readiness_formula: {
      firm_name_set:           20,
      positioning_set:         20,
      brand_assets_configured: 15,
      web_presence_confirmed:  20,
      crm_enabled:             15,
      templates_available:     10,
    },
    next_default_phase: 'thesis',
  },

  thesis: {
    phase_key:    'thesis',
    phase_label:  'Investment Thesis',
    objective:    'Define the acquisition thesis, buy box, and ideal target profile.',
    order:        2,
    entry_requirements: ['identity_complete'],
    required_tasks: [
      'select_industry', 'select_target_geography', 'define_buy_box',
      'define_disqualifiers', 'write_fragmentation_rationale', 'write_why_now_rationale',
      'define_ideal_target_profile',
    ],
    optional_tasks: ['draft_investment_memo_outline', 'define_value_creation_thesis'],
    exit_requirements: [
      'industry_selected', 'geography_selected', 'buy_box_defined',
      'disqualifiers_defined', 'fragmentation_rationale_exists', 'why_now_rationale_exists',
      'ideal_target_profile_exists',
    ],
    blocking_rules: ['identity_incomplete'],
    proof_rules: ['buy_box_defined', 'disqualifiers_defined'],
    readiness_formula: {
      industry_selected:            20,
      geography_selected:           10,
      buy_box_defined:              25,
      disqualifiers_defined:        15,
      fragmentation_rationale_exists: 15,
      why_now_rationale_exists:     10,
      ideal_target_profile_exists:  5,
    },
    next_default_phase: 'targeting',
  },

  board: {
    phase_key:    'board',
    phase_label:  'Board Assembly',
    objective:    'Identify, outreach, and secure board members.',
    order:        3,
    entry_requirements: ['thesis_complete'],
    required_tasks: [
      'define_6_board_seats', 'seed_candidate_pipeline', 'prioritize_industry_veteran',
      'activate_board_outreach_system', 'create_board_pitch_asset', 'complete_first_outreach_batch',
    ],
    optional_tasks: ['draft_board_charter', 'prepare_comp_framework'],
    exit_requirements: [
      'seat_definitions_complete', 'candidate_pipeline_started', 'industry_veteran_prioritized',
      'board_outreach_active', 'board_pitch_asset_exists', 'first_outreach_batch_completed',
    ],
    blocking_rules: ['thesis_incomplete'],
    proof_rules: ['first_outreach_batch_completed', 'board_pitch_asset_exists'],
    readiness_formula: {
      seat_definitions_complete:       20,
      candidate_pipeline_started:      15,
      industry_veteran_prioritized:    10,
      board_outreach_active:           20,
      board_pitch_asset_exists:        15,
      first_outreach_batch_completed:  20,
    },
    next_default_phase: 'targeting',
  },

  targeting: {
    phase_key:    'targeting',
    phase_label:  'Target Identification',
    objective:    'Build a qualified target list with active seller signal monitoring.',
    order:        4,
    entry_requirements: ['thesis_complete'],
    required_tasks: [
      'enable_source_ingestion', 'verify_manual_target_creation', 'define_source_labels',
      'activate_seller_signals', 'set_research_completeness_baseline', 'seed_target_list',
    ],
    optional_tasks: ['configure_auto_scoring', 'set_exclusion_filters'],
    exit_requirements: [
      'source_ingestion_enabled', 'manual_creation_works', 'source_labels_defined',
      'seller_signals_active', 'research_baseline_set', 'target_list_seeded',
    ],
    blocking_rules: ['thesis_incomplete'],
    proof_rules: ['target_list_seeded', 'seller_signals_active'],
    readiness_formula: {
      source_ingestion_enabled:  20,
      manual_creation_works:     10,
      source_labels_defined:     10,
      seller_signals_active:     25,
      research_baseline_set:     15,
      target_list_seeded:        20,
    },
    next_default_phase: 'outreach',
  },

  outreach: {
    phase_key:    'outreach',
    phase_label:  'Outreach',
    objective:    'Execute systematic outreach with tracked proof and follow-up cadence.',
    order:        5,
    entry_requirements: ['targeting_active'],
    required_tasks: [
      'activate_sequence_engine', 'enable_outreach_logging', 'configure_followup_tasks',
      'enable_proof_capture', 'reach_minimum_outreach_threshold',
    ],
    optional_tasks: ['configure_reply_routing', 'set_daily_outreach_goal'],
    exit_requirements: [
      'sequence_engine_active', 'outreach_logging_active', 'followup_tasks_generated',
      'proof_capture_active', 'minimum_outreach_threshold_met',
    ],
    blocking_rules: ['targeting_incomplete'],
    proof_rules: ['proof_capture_active', 'minimum_outreach_threshold_met'],
    readiness_formula: {
      sequence_engine_active:           25,
      outreach_logging_active:          20,
      followup_tasks_generated:         15,
      proof_capture_active:             20,
      minimum_outreach_threshold_met:   20,
    },
    next_default_phase: 'conversation',
  },

  conversation: {
    phase_key:    'conversation',
    phase_label:  'Conversation',
    objective:    'Convert outreach into tracked conversations with next steps.',
    order:        6,
    entry_requirements: ['outreach_generated_replies_or_meetings'],
    required_tasks: [
      'activate_meeting_prep_flow', 'store_conversation_summaries', 'track_objections',
      'log_next_steps', 'activate_followup_cadence',
    ],
    optional_tasks: ['set_deal_intro_threshold', 'configure_conversation_templates'],
    exit_requirements: [
      'meeting_prep_active', 'summaries_stored', 'objections_tracked',
      'next_steps_logged', 'followup_cadence_active',
    ],
    blocking_rules: ['outreach_insufficient'],
    proof_rules: ['summaries_stored', 'next_steps_logged'],
    readiness_formula: {
      meeting_prep_active:    25,
      summaries_stored:       20,
      objections_tracked:     15,
      next_steps_logged:      25,
      followup_cadence_active: 15,
    },
    next_default_phase: 'evaluation',
  },

  evaluation: {
    phase_key:    'evaluation',
    phase_label:  'Deal Evaluation',
    objective:    'Run deterministic first-pass underwriting and fatal flag evaluation.',
    order:        7,
    entry_requirements: ['conversation_active_or_financials_received'],
    required_tasks: [
      'complete_financial_intake', 'run_sde_normalization', 'run_dscr', 'evaluate_fatal_flags',
      'generate_deal_memo_or_decision_summary',
    ],
    optional_tasks: ['draft_loi_term_sheet', 'schedule_management_call'],
    exit_requirements: [
      'financial_intake_sufficient', 'sde_normalization_run', 'dscr_run',
      'fatal_flags_evaluated', 'decision_summary_exists',
    ],
    blocking_rules: ['financials_insufficient'],
    proof_rules: ['sde_normalization_run', 'dscr_run', 'fatal_flags_evaluated'],
    readiness_formula: {
      financial_intake_sufficient: 30,
      sde_normalization_run:       20,
      dscr_run:                    20,
      fatal_flags_evaluated:       20,
      decision_summary_exists:     10,
    },
    next_default_phase: 'loi',
  },

  loi: {
    phase_key:    'loi',
    phase_label:  'Letter of Intent',
    objective:    'Prepare and submit a viable LOI based on sound structure.',
    order:        8,
    entry_requirements: ['evaluation_pass_or_conditional_pass'],
    required_tasks: [
      'prepare_structure_scenarios', 'review_major_blockers', 'record_deal_stance',
      'pass_loi_readiness_gate',
    ],
    optional_tasks: ['schedule_loi_call', 'prepare_seller_faq'],
    exit_requirements: [
      'structure_scenarios_prepared', 'blockers_reviewed', 'deal_stance_recorded',
      'loi_readiness_gate_passed',
    ],
    blocking_rules: ['fatal_flags_present', 'dscr_below_threshold'],
    proof_rules: ['deal_stance_recorded', 'loi_readiness_gate_passed'],
    readiness_formula: {
      structure_scenarios_prepared: 30,
      blockers_reviewed:            25,
      deal_stance_recorded:         20,
      loi_readiness_gate_passed:    25,
    },
    next_default_phase: 'diligence',
  },

  diligence: {
    phase_key:    'diligence',
    phase_label:  'Due Diligence',
    objective:    'Systematically resolve all material issues before financing.',
    order:        9,
    entry_requirements: ['loi_or_exclusivity_reached'],
    required_tasks: [
      'activate_document_checklist', 'activate_issue_tracker', 'assign_issue_owners',
      'reach_diligence_completeness_threshold', 'handle_or_escalate_fatal_issues',
    ],
    optional_tasks: ['engage_qoe_provider', 'engage_legal_counsel'],
    exit_requirements: [
      'document_checklist_active', 'issue_tracker_active', 'issue_owners_assigned',
      'diligence_completeness_above_threshold', 'fatal_issues_handled',
    ],
    blocking_rules: ['unresolved_fatal_issues', 'completeness_below_threshold'],
    proof_rules: ['issue_owners_assigned', 'diligence_completeness_above_threshold'],
    readiness_formula: {
      document_checklist_active:             20,
      issue_tracker_active:                  15,
      issue_owners_assigned:                 20,
      diligence_completeness_above_threshold: 30,
      fatal_issues_handled:                  15,
    },
    next_default_phase: 'financing',
  },

  financing: {
    phase_key:    'financing',
    phase_label:  'Financing',
    objective:    'Secure capital stack and prepare lender package.',
    order:        10,
    entry_requirements: ['diligence_sufficiently_advanced'],
    required_tasks: [
      'build_capital_stack_scenarios', 'reach_lender_readiness_threshold',
      'complete_package_checklist', 'identify_key_blockers',
    ],
    optional_tasks: ['engage_sba_lender', 'prepare_cim'],
    exit_requirements: [
      'capital_stack_scenarios_built', 'lender_readiness_above_threshold',
      'package_checklist_complete', 'key_blockers_assigned',
    ],
    blocking_rules: ['diligence_incomplete', 'fatal_issues_unresolved'],
    proof_rules: ['capital_stack_scenarios_built', 'lender_readiness_above_threshold'],
    readiness_formula: {
      capital_stack_scenarios_built:      25,
      lender_readiness_above_threshold:   30,
      package_checklist_complete:         25,
      key_blockers_assigned:              20,
    },
    next_default_phase: 'close',
  },

  close: {
    phase_key:    'close',
    phase_label:  'Close',
    objective:    'Execute closing and ensure transition readiness.',
    order:        11,
    entry_requirements: ['financing_ready', 'close_readiness_threshold_met'],
    required_tasks: [
      'complete_close_checklist', 'finalize_transition_plan',
      'assign_owner_responsibilities', 'set_up_post_close_operations',
    ],
    optional_tasks: ['prepare_announcement', 'schedule_kickoff_call'],
    exit_requirements: [
      'close_checklist_complete', 'transition_plan_exists',
      'owner_assignments_complete', 'post_close_setup_exists',
    ],
    blocking_rules: ['financing_not_confirmed', 'close_checklist_incomplete'],
    proof_rules: ['close_checklist_complete', 'transition_plan_exists'],
    readiness_formula: {
      close_checklist_complete:  30,
      transition_plan_exists:    25,
      owner_assignments_complete: 25,
      post_close_setup_exists:   20,
    },
    next_default_phase: 'post_close',
  },

  post_close: {
    phase_key:    'post_close',
    phase_label:  'Post-Close Operations',
    objective:    'Stabilize operations and activate operating cadence.',
    order:        12,
    entry_requirements: ['deal_closed'],
    required_tasks: [
      'activate_30_60_90_plan', 'activate_operating_cadence', 'activate_board_reporting',
      'activate_kpi_capture', 'assign_stabilization_tasks',
    ],
    optional_tasks: ['conduct_seller_debrief', 'onboard_key_employees'],
    exit_requirements: [
      'plan_30_60_90_active', 'operating_cadence_active', 'board_reporting_active',
      'kpi_capture_active', 'stabilization_tasks_assigned',
    ],
    blocking_rules: ['close_incomplete'],
    proof_rules: ['plan_30_60_90_active', 'kpi_capture_active'],
    readiness_formula: {
      plan_30_60_90_active:         25,
      operating_cadence_active:     20,
      board_reporting_active:       20,
      kpi_capture_active:           20,
      stabilization_tasks_assigned: 15,
    },
    next_default_phase: 'roll_up',
  },

  roll_up: {
    phase_key:    'roll_up',
    phase_label:  'Roll-Up',
    objective:    'Execute tuck-in acquisitions and build platform value.',
    order:        13,
    entry_requirements: ['first_platform_company_stabilized'],
    required_tasks: [
      'refine_platform_thesis', 'activate_tuck_in_comparison', 'create_integration_playbook',
      'activate_ev_progression_logic',
    ],
    optional_tasks: ['engage_investment_banker', 'prepare_lp_update'],
    exit_requirements: [
      'platform_thesis_refined', 'tuck_in_comparison_active',
      'integration_playbook_exists', 'ev_progression_active',
    ],
    blocking_rules: ['post_close_incomplete'],
    proof_rules: ['integration_playbook_exists'],
    readiness_formula: {
      platform_thesis_refined:    25,
      tuck_in_comparison_active:  25,
      integration_playbook_exists: 25,
      ev_progression_active:      25,
    },
    next_default_phase: 'exit',
  },

  exit: {
    phase_key:    'exit',
    phase_label:  'Exit',
    objective:    'Prepare and execute exit event.',
    order:        14,
    entry_requirements: ['roll_up_maturity_sufficient'],
    required_tasks: ['prepare_exit_artifacts', 'activate_exit_tracking'],
    optional_tasks: ['engage_m_and_a_advisor', 'prepare_buyer_list'],
    exit_requirements: ['exit_artifacts_ready', 'exit_tracking_active'],
    blocking_rules: ['roll_up_incomplete'],
    proof_rules: ['exit_artifacts_ready'],
    readiness_formula: {
      exit_artifacts_ready:  50,
      exit_tracking_active:  50,
    },
    next_default_phase: null,
  },
};

export const PHASE_ORDER = Object.values(PHASES)
  .sort((a, b) => a.order - b.order)
  .map((p) => p.phase_key);

// ─── Gate types ───────────────────────────────────────────────────────────────

export const GATE_TYPES = {
  MISSING_RECORD:            'missing_record',
  MISSING_PROOF:             'missing_proof',
  MISSING_SCORE_THRESHOLD:   'missing_score_threshold',
  FATAL_FLAG_PRESENT:        'fatal_flag_present',
  REQUIRED_TASK_INCOMPLETE:  'required_task_incomplete',
  REQUIRED_DOCUMENT_MISSING: 'required_document_missing',
  APPROVAL_REQUIRED:         'approval_required',
  DEPENDENCY_PHASE_INCOMPLETE: 'dependency_phase_incomplete',
};

// ─── Gate evaluation ──────────────────────────────────────────────────────────

/**
 * Evaluate a single gate condition.
 * Returns: { gate_key, status, reason, blocking_entity_ids, recommended_fix, severity }
 */
export function evaluateGate({ gate_key, gate_type, condition, blocking_entity_ids = [], recommended_fix = '', severity = 'high' }) {
  const passes = typeof condition === 'function' ? condition() : Boolean(condition);
  return {
    gate_key,
    gate_type,
    status:               passes ? 'pass' : 'fail',
    reason:               passes ? `${gate_key} condition satisfied` : recommended_fix,
    blocking_entity_ids,
    recommended_fix,
    severity,
  };
}

/**
 * Evaluate all exit gates for a phase.
 * @param {string} phaseKey
 * @param {object} ctx — proof state, records, scores, flags etc.
 * @returns {{ phase_key, all_pass, gates: Gate[], readiness_score }}
 */
export function evaluatePhaseGates(phaseKey, ctx = {}) {
  const phase = PHASES[phaseKey];
  if (!phase) throw new Error(`Unknown phase: ${phaseKey}`);

  const gates = _buildGatesForPhase(phase, ctx);
  const allPass = gates.every((g) => g.status === 'pass');
  const readiness = calculateReadiness(phaseKey, ctx);

  return {
    phase_key:      phaseKey,
    all_pass:       allPass,
    can_advance:    allPass,
    gates,
    readiness_score: readiness.score,
    readiness_breakdown: readiness.breakdown,
    blocking_gates: gates.filter((g) => g.status === 'fail'),
  };
}

/**
 * Check entry requirements for a phase.
 */
export function canEnterPhase(phaseKey, ctx = {}) {
  const phase = PHASES[phaseKey];
  if (!phase) return { allowed: false, reason: `Unknown phase: ${phaseKey}` };

  const missing = phase.entry_requirements.filter((req) => !ctx[req]);
  return {
    allowed:         missing.length === 0,
    missing_entries: missing,
    reason:          missing.length ? `Entry blocked: ${missing.join(', ')}` : 'Entry allowed',
  };
}

/**
 * Attempt a phase transition. Returns structured result — never mutates state.
 * Caller is responsible for persisting transition.
 */
export function evaluateTransition(currentPhase, targetPhase, ctx = {}) {
  const entryCheck = canEnterPhase(targetPhase, ctx);
  if (!entryCheck.allowed) {
    return { allowed: false, reason: entryCheck.reason, gates: [] };
  }

  const gateCheck = evaluatePhaseGates(currentPhase, ctx);
  return {
    allowed:         gateCheck.can_advance,
    from_phase:      currentPhase,
    to_phase:        targetPhase,
    gates:           gateCheck.gates,
    blocking_gates:  gateCheck.blocking_gates,
    readiness_score: gateCheck.readiness_score,
    reason:          gateCheck.can_advance
      ? `Phase transition from ${currentPhase} to ${targetPhase} approved`
      : `Phase exit blocked: ${gateCheck.blocking_gates.map((g) => g.gate_key).join(', ')}`,
  };
}

// ─── Readiness score ──────────────────────────────────────────────────────────

/**
 * Calculate phase readiness score 0-100.
 * Each formula key maps to a weight; met conditions add weight proportionally.
 */
export function calculateReadiness(phaseKey, ctx = {}) {
  const phase = PHASES[phaseKey];
  if (!phase) return { score: 0, breakdown: {} };

  const formula = phase.readiness_formula;
  const totalWeight = Object.values(formula).reduce((s, w) => s + w, 0);
  const breakdown = {};
  let earned = 0;

  for (const [key, weight] of Object.entries(formula)) {
    const met = Boolean(ctx[key]);
    breakdown[key] = { weight, met, contribution: met ? weight : 0 };
    if (met) earned += weight;
  }

  return {
    score:     totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0,
    earned,
    total:     totalWeight,
    breakdown,
  };
}

// ─── Current phase detection ──────────────────────────────────────────────────

/**
 * Given completion context across all phases, return the current active phase.
 * The current phase is the earliest phase whose exit requirements are NOT fully met.
 */
export function detectCurrentPhase(completionCtx = {}) {
  for (const phaseKey of PHASE_ORDER) {
    const phase = PHASES[phaseKey];
    const allExitMet = phase.exit_requirements.every((req) => Boolean(completionCtx[req]));
    if (!allExitMet) {
      return {
        current_phase:  phaseKey,
        phase_label:    phase.phase_label,
        readiness:      calculateReadiness(phaseKey, completionCtx),
      };
    }
  }
  return { current_phase: 'exit', phase_label: PHASES.exit.phase_label, readiness: { score: 100, breakdown: {} } };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function _buildGatesForPhase(phase, ctx) {
  const gates = [];

  // Exit requirement gates
  for (const req of phase.exit_requirements) {
    gates.push(evaluateGate({
      gate_key:            `exit_req:${req}`,
      gate_type:           GATE_TYPES.REQUIRED_TASK_INCOMPLETE,
      condition:           Boolean(ctx[req]),
      recommended_fix:     `Complete requirement: ${req}`,
      severity:            'high',
    }));
  }

  // Blocking rule gates
  for (const block of phase.blocking_rules) {
    // blocking rules are fail if the condition IS true (they block progress)
    gates.push(evaluateGate({
      gate_key:            `blocking_rule:${block}`,
      gate_type:           GATE_TYPES.FATAL_FLAG_PRESENT,
      condition:           !ctx[block],   // passes if blocker is NOT present
      recommended_fix:     `Resolve blocker: ${block}`,
      severity:            'critical',
    }));
  }

  // Proof rule gates
  for (const proof of phase.proof_rules) {
    gates.push(evaluateGate({
      gate_key:            `proof:${proof}`,
      gate_type:           GATE_TYPES.MISSING_PROOF,
      condition:           Boolean(ctx[proof]),
      recommended_fix:     `Provide proof for: ${proof}`,
      severity:            'high',
    }));
  }

  return gates;
}

export default {
  PHASES, PHASE_ORDER, GATE_TYPES,
  evaluateGate, evaluatePhaseGates, canEnterPhase,
  evaluateTransition, calculateReadiness, detectCurrentPhase,
};
