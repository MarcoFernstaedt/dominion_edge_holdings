/**
 * SequenceEngine — deterministic outreach sequence management.
 *
 * Rules:
 *  - Step selection and branching are always deterministic.
 *  - AI may draft copy for a step — it never selects or skips steps.
 *  - Proof requirements for each step are explicit.
 *  - Success and failure paths are rule-based.
 */

// ─── Sequence definitions ─────────────────────────────────────────────────────

export const SEQUENCES = {

  // ── Seller sequences ────────────────────────────────────────────────────────

  seller_first_touch: {
    sequence_key:  'seller_first_touch',
    audience:      'seller',
    trigger:       'target_added_to_pipeline',
    steps: [
      { step_number: 1, delay_days: 0,  channel: 'email',  goal: 'introduce_firm_and_gauge_interest',   template_key: 'seller_intro_email',       success_condition: 'reply_received',      failure_condition: 'no_reply_7d',        next_step_on_success: 'seller_discovery_call', next_step_on_failure: 'seller_second_touch', proof_type: 'message_sent' },
      { step_number: 2, delay_days: 7,  channel: 'email',  goal: 'follow_up_and_share_credibility',     template_key: 'seller_followup_1_email',  success_condition: 'reply_received',      failure_condition: 'no_reply_7d',        next_step_on_success: 'seller_discovery_call', next_step_on_failure: 'seller_third_touch',  proof_type: 'message_sent' },
    ],
  },

  seller_second_touch: {
    sequence_key:  'seller_second_touch',
    audience:      'seller',
    trigger:       'no_reply_after_step_1',
    steps: [
      { step_number: 1, delay_days: 0,  channel: 'email',  goal: 'resurface_interest_with_social_proof', template_key: 'seller_touch_2_email',  success_condition: 'reply_received',     failure_condition: 'no_reply_7d',        next_step_on_success: 'seller_discovery_call', next_step_on_failure: 'seller_third_touch',   proof_type: 'message_sent' },
    ],
  },

  seller_third_touch: {
    sequence_key:  'seller_third_touch',
    audience:      'seller',
    trigger:       'no_reply_after_touch_2',
    steps: [
      { step_number: 1, delay_days: 0,  channel: 'phone',  goal: 'brief_voicemail_or_live_call',        template_key: 'seller_call_script',    success_condition: 'call_logged',        failure_condition: 'no_answer',          next_step_on_success: 'seller_discovery_call', next_step_on_failure: 'seller_reactivation', proof_type: 'call_logged' },
    ],
  },

  seller_post_letter_follow_up: {
    sequence_key:  'seller_post_letter_follow_up',
    audience:      'seller',
    trigger:       'direct_mail_letter_sent',
    steps: [
      { step_number: 1, delay_days: 5,  channel: 'phone',  goal: 'confirm_letter_received_and_interest', template_key: 'seller_letter_follow_up_call', success_condition: 'positive_response', failure_condition: 'no_answer',       next_step_on_success: 'seller_discovery_call', next_step_on_failure: 'seller_second_touch', proof_type: 'call_logged' },
    ],
  },

  seller_meeting_confirmation: {
    sequence_key:  'seller_meeting_confirmation',
    audience:      'seller',
    trigger:       'meeting_scheduled',
    steps: [
      { step_number: 1, delay_days: -2, channel: 'email',  goal: 'confirm_meeting_and_share_agenda',    template_key: 'seller_meeting_confirm_email', success_condition: 'confirmed',         failure_condition: 'no_response',      next_step_on_success: 'meeting_completed', next_step_on_failure: 'meeting_reschedule_attempt', proof_type: 'message_sent' },
    ],
  },

  seller_post_meeting_follow_up: {
    sequence_key:  'seller_post_meeting_follow_up',
    audience:      'seller',
    trigger:       'meeting_completed',
    steps: [
      { step_number: 1, delay_days: 1,  channel: 'email',  goal: 'thank_seller_and_confirm_next_step', template_key: 'seller_post_meeting_email',  success_condition: 'reply_received',     failure_condition: 'no_reply_5d',        next_step_on_success: 'continue_evaluation', next_step_on_failure: 'seller_reactivation', proof_type: 'message_sent' },
    ],
  },

  seller_reactivation: {
    sequence_key:  'seller_reactivation',
    audience:      'seller',
    trigger:       'no_response_60d_or_ghosted',
    steps: [
      { step_number: 1, delay_days: 0,  channel: 'email',  goal: 'check_in_and_update_context',        template_key: 'seller_reactivation_email',  success_condition: 'reply_received',     failure_condition: 'no_reply_14d',       next_step_on_success: 'seller_post_meeting_follow_up', next_step_on_failure: 'seller_breakup', proof_type: 'message_sent' },
    ],
  },

  seller_breakup: {
    sequence_key:  'seller_breakup',
    audience:      'seller',
    trigger:       'no_response_after_reactivation',
    steps: [
      { step_number: 1, delay_days: 0,  channel: 'email',  goal: 'close_loop_and_leave_door_open',     template_key: 'seller_breakup_email',       success_condition: 'reply_received_reopen', failure_condition: 'no_reply',       next_step_on_success: 'seller_first_touch',    next_step_on_failure: 'archive_target', proof_type: 'message_sent' },
    ],
  },

  // ── Board sequences ──────────────────────────────────────────────────────────

  board_first_touch: {
    sequence_key:  'board_first_touch',
    audience:      'board_candidate',
    trigger:       'candidate_added_to_board_pipeline',
    steps: [
      { step_number: 1, delay_days: 0,  channel: 'email',  goal: 'introduce_board_opportunity',        template_key: 'board_intro_email',          success_condition: 'reply_received',     failure_condition: 'no_reply_7d',        next_step_on_success: 'board_meeting_scheduled', next_step_on_failure: 'board_follow_up_1', proof_type: 'message_sent' },
    ],
  },

  board_follow_up_1: {
    sequence_key:  'board_follow_up_1',
    audience:      'board_candidate',
    trigger:       'no_reply_after_board_first_touch',
    steps: [
      { step_number: 1, delay_days: 7,  channel: 'email',  goal: 'resurface_opportunity_with_context', template_key: 'board_followup_1_email',     success_condition: 'reply_received',     failure_condition: 'no_reply_7d',        next_step_on_success: 'board_meeting_scheduled', next_step_on_failure: 'board_follow_up_2', proof_type: 'message_sent' },
    ],
  },

  board_follow_up_2: {
    sequence_key:  'board_follow_up_2',
    audience:      'board_candidate',
    trigger:       'no_reply_after_follow_up_1',
    steps: [
      { step_number: 1, delay_days: 10, channel: 'phone',  goal: 'brief_outreach_or_voicemail',        template_key: 'board_call_script',          success_condition: 'call_logged',        failure_condition: 'no_answer',          next_step_on_success: 'board_meeting_scheduled', next_step_on_failure: 'archive_candidate', proof_type: 'call_logged' },
    ],
  },

  board_post_meeting: {
    sequence_key:  'board_post_meeting',
    audience:      'board_candidate',
    trigger:       'board_meeting_completed',
    steps: [
      { step_number: 1, delay_days: 1,  channel: 'email',  goal: 'thank_candidate_and_share_materials', template_key: 'board_post_meeting_email',  success_condition: 'reply_received',     failure_condition: 'no_reply_5d',        next_step_on_success: 'board_commitment_ask', next_step_on_failure: 'board_objection_follow_up', proof_type: 'message_sent' },
    ],
  },

  board_objection_follow_up: {
    sequence_key:  'board_objection_follow_up',
    audience:      'board_candidate',
    trigger:       'objection_raised',
    steps: [
      { step_number: 1, delay_days: 3,  channel: 'email',  goal: 'address_objection_and_maintain_interest', template_key: 'board_objection_email',  success_condition: 'objection_resolved', failure_condition: 'objection_unresolved', next_step_on_success: 'board_commitment_ask', next_step_on_failure: 'archive_candidate', proof_type: 'message_sent' },
    ],
  },

  board_commitment_ask: {
    sequence_key:  'board_commitment_ask',
    audience:      'board_candidate',
    trigger:       'positive_meeting_or_objection_resolved',
    steps: [
      { step_number: 1, delay_days: 2,  channel: 'email',  goal: 'formal_board_seat_offer',            template_key: 'board_commitment_ask_email', success_condition: 'commitment_received', failure_condition: 'no_reply_7d',       next_step_on_success: 'board_thank_you_next_steps', next_step_on_failure: 'board_objection_follow_up', proof_type: 'message_sent' },
    ],
  },

  board_thank_you_next_steps: {
    sequence_key:  'board_thank_you_next_steps',
    audience:      'board_candidate',
    trigger:       'commitment_received',
    steps: [
      { step_number: 1, delay_days: 1,  channel: 'email',  goal: 'confirm_commitment_and_onboarding',  template_key: 'board_thank_you_email',     success_condition: 'confirmed',          failure_condition: 'no_response',        next_step_on_success: 'board_onboarding', next_step_on_failure: 'board_commitment_ask', proof_type: 'message_sent' },
    ],
  },

  // ── Investor sequences ───────────────────────────────────────────────────────

  investor_intro_request: {
    sequence_key:  'investor_intro_request',
    audience:      'warm_contact',
    trigger:       'intro_to_investor_needed',
    steps: [
      { step_number: 1, delay_days: 0,  channel: 'email',  goal: 'request_warm_intro',                 template_key: 'investor_intro_request_email', success_condition: 'intro_made',       failure_condition: 'no_reply_5d',        next_step_on_success: 'investor_first_touch', next_step_on_failure: 'cold_outreach', proof_type: 'message_sent' },
    ],
  },

  investor_first_touch: {
    sequence_key:  'investor_first_touch',
    audience:      'investor',
    trigger:       'investor_added_to_pipeline',
    steps: [
      { step_number: 1, delay_days: 0,  channel: 'email',  goal: 'introduce_opportunity_and_gauge_fit', template_key: 'investor_intro_email',       success_condition: 'reply_received',     failure_condition: 'no_reply_7d',        next_step_on_success: 'investor_memo_send', next_step_on_failure: 'investor_follow_up', proof_type: 'message_sent' },
    ],
  },

  investor_memo_send: {
    sequence_key:  'investor_memo_send',
    audience:      'investor',
    trigger:       'positive_response_from_first_touch',
    steps: [
      { step_number: 1, delay_days: 2,  channel: 'email',  goal: 'send_investor_memo_and_request_call', template_key: 'investor_memo_send_email',  success_condition: 'call_scheduled',     failure_condition: 'no_reply_7d',        next_step_on_success: 'investor_traction_update', next_step_on_failure: 'investor_follow_up', proof_type: 'deliverable_generated' },
    ],
  },

  investor_follow_up: {
    sequence_key:  'investor_follow_up',
    audience:      'investor',
    trigger:       'no_response_after_first_touch',
    steps: [
      { step_number: 1, delay_days: 7,  channel: 'email',  goal: 'follow_up_with_traction_hook',       template_key: 'investor_followup_email',    success_condition: 'reply_received',     failure_condition: 'no_reply_7d',        next_step_on_success: 'investor_memo_send', next_step_on_failure: 'investor_reactivation', proof_type: 'message_sent' },
    ],
  },

  investor_traction_update: {
    sequence_key:  'investor_traction_update',
    audience:      'investor',
    trigger:       'meaningful_deal_progress',
    steps: [
      { step_number: 1, delay_days: 0,  channel: 'email',  goal: 'share_progress_and_maintain_interest', template_key: 'investor_traction_email',  success_condition: 'engagement_maintained', failure_condition: 'no_reply_14d',   next_step_on_success: 'continue_investor_pipeline', next_step_on_failure: 'investor_reactivation', proof_type: 'message_sent' },
    ],
  },

  investor_reactivation: {
    sequence_key:  'investor_reactivation',
    audience:      'investor',
    trigger:       'investor_gone_cold',
    steps: [
      { step_number: 1, delay_days: 0,  channel: 'email',  goal: 'reopen_conversation_with_new_angle', template_key: 'investor_reactivation_email', success_condition: 'reply_received',    failure_condition: 'no_reply_14d',       next_step_on_success: 'investor_memo_send', next_step_on_failure: 'archive_investor', proof_type: 'message_sent' },
    ],
  },
};

// ─── Next step calculation ────────────────────────────────────────────────────

/**
 * Given a sequence state for a target, calculate the next due step.
 * @param {object} state
 * @param {string}   state.sequence_key
 * @param {number}   state.last_completed_step
 * @param {string}   state.last_step_outcome  — 'success' | 'failure' | null
 * @param {string}   state.last_step_date
 * @returns {{ next_step, due_date, overdue, expected_proof, stage_on_success, recovery_on_failure }}
 */
export function calculateNextStep(state = {}) {
  const { sequence_key, last_completed_step = 0, last_step_outcome = null, last_step_date = null } = state;
  const sequence = SEQUENCES[sequence_key];
  if (!sequence) return { error: `Unknown sequence: ${sequence_key}`, next_step: null };

  const nextStepNumber = last_completed_step + 1;
  const currentStep    = sequence.steps.find((s) => s.step_number === nextStepNumber);
  if (!currentStep) return { completed: true, sequence_key, message: 'Sequence complete — no more steps' };

  const dueDate = last_step_date
    ? _addDays(last_step_date, currentStep.delay_days)
    : new Date().toISOString();

  const overdue = new Date(dueDate) < new Date();

  return {
    sequence_key,
    next_step:               currentStep,
    step_number:             currentStep.step_number,
    channel:                 currentStep.channel,
    template_key:            currentStep.template_key,
    goal:                    currentStep.goal,
    due_date:                dueDate,
    overdue,
    expected_proof:          currentStep.proof_type,
    stage_transition_on_success: currentStep.next_step_on_success,
    recovery_action_on_failure:  currentStep.next_step_on_failure,
    requires_ai_draft:       ['email'].includes(currentStep.channel),
  };
}

/**
 * Advance a sequence state after a step completes.
 * Returns updated state — caller must persist.
 */
export function advanceStep(state = {}, { outcome, proof_reference = null }) {
  const validOutcomes = ['success', 'failure'];
  if (!validOutcomes.includes(outcome)) return { error: `Invalid outcome: ${outcome}. Must be 'success' or 'failure'` };

  const nextStep = calculateNextStep(state);
  return {
    sequence_key:          state.sequence_key,
    last_completed_step:   nextStep.step_number,
    last_step_outcome:     outcome,
    last_step_date:        new Date().toISOString(),
    proof_reference,
    resolved_to:           outcome === 'success' ? nextStep.stage_transition_on_success : nextStep.recovery_action_on_failure,
  };
}

/**
 * Get all sequences applicable to a given audience type.
 */
export function sequencesForAudience(audience) {
  return Object.values(SEQUENCES).filter((s) => s.audience === audience);
}

/**
 * Determine which sequence to start for a target based on context.
 */
export function recommendSequence(audience, ctx = {}) {
  if (audience === 'seller') {
    if (ctx.letter_sent)            return 'seller_post_letter_follow_up';
    if (ctx.meeting_completed)      return 'seller_post_meeting_follow_up';
    if (ctx.meeting_scheduled)      return 'seller_meeting_confirmation';
    if (ctx.days_since_contact > 60) return 'seller_reactivation';
    return 'seller_first_touch';
  }
  if (audience === 'board_candidate') {
    if (ctx.commitment_received)    return 'board_thank_you_next_steps';
    if (ctx.meeting_completed)      return 'board_post_meeting';
    if (ctx.objection_raised)       return 'board_objection_follow_up';
    if (ctx.meeting_scheduled)      return 'board_post_meeting';
    return 'board_first_touch';
  }
  if (audience === 'investor') {
    if (ctx.warm_intro_available)   return 'investor_intro_request';
    if (ctx.positive_response)      return 'investor_memo_send';
    if (ctx.gone_cold)              return 'investor_reactivation';
    return 'investor_first_touch';
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export default {
  SEQUENCES, calculateNextStep, advanceStep,
  sequencesForAudience, recommendSequence,
};
