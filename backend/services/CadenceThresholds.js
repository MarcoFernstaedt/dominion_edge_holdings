/**
 * CadenceThresholds — single source of truth for all timing thresholds.
 *
 * Rules:
 *  - No magic numbers may appear in timing/SLA business logic outside this file.
 *  - All values are in HOURS unless suffixed _DAYS.
 *  - Tune values here; do NOT edit individual service files for threshold changes.
 *  - Exported as plain objects so callers may spread/override per-context if needed.
 */

// ─── Task SLA thresholds ──────────────────────────────────────────────────────

export const TASK_THRESHOLDS = {
  // How many hours ahead counts as "due soon" per priority
  due_soon_hours: {
    critical: 6,
    high:     24,
    medium:   48,
    low:      72,
  },

  // Default expected completion window (hours) from creation if no explicit due date
  default_due_hours: {
    critical: 8,
    high:     48,
    medium:   120,   // 5 days
    low:      168,   // 7 days
  },

  // How many hours overdue before state becomes critical_overdue
  critical_overdue_hours: {
    critical: 24,
    high:     72,
    medium:   168,   // 7 days
    low:      336,   // 14 days
  },
};

// ─── Deal stage SLA thresholds (hours per stage before watch/slow/critical) ──

export const DEAL_STAGE_THRESHOLDS = {
  // hours in stage before entering WATCH state
  watch_hours: {
    identified:           96,    // 4 days
    researched:           96,
    contacted:            96,
    responded:            72,    // 3 days
    conversation:         96,
    financials_requested: 144,   // 6 days
    financials_received:  72,
    under_review:         96,
    loi_drafting:         72,
    loi_sent:             96,
    exclusivity:          96,
    diligence:            168,   // 7 days
    financing:            144,
    closing:              96,
  },

  // hours before entering SLOW state (spec thresholds converted)
  slow_hours: {
    identified:           168,   // 7 days
    researched:           168,
    contacted:            168,
    responded:            120,   // 5 days
    conversation:         168,
    financials_requested: 240,   // 10 days
    financials_received:  120,
    under_review:         168,
    loi_drafting:         120,
    loi_sent:             168,
    exclusivity:          168,
    diligence:            336,   // 14 days
    financing:            240,
    closing:              168,
  },

  // hours before entering CRITICAL state
  critical_hours: {
    identified:           336,   // 14 days
    researched:           336,
    contacted:            336,
    responded:            240,   // 10 days
    conversation:         336,
    financials_requested: 480,   // 20 days
    financials_received:  240,
    under_review:         336,
    loi_drafting:         240,
    loi_sent:             336,
    exclusivity:          336,
    diligence:            672,   // 28 days
    financing:            480,
    closing:              336,
  },

  // Hours of inactivity across all stages before heat degrades
  heat_decay: {
    hot_max_silence_hours:      48,
    warm_max_silence_hours:     120,   // 5 days
    lukewarm_max_silence_hours: 240,   // 10 days
    cold_max_silence_hours:     480,   // 20 days
    // beyond cold_max = dead
  },
};

// ─── Relationship cadence thresholds (hours of silence before risk state) ────

export const RELATIONSHIP_THRESHOLDS = {
  // Max silence before state escalates, keyed by cadence profile
  silence_hours: {
    high_influence_active: 168,    // 7 days
    high_influence_cold:   336,    // 14 days — should re-engage soon
    trusted:               336,    // 14 days
    advocate:              480,    // 20 days (update every 14-30 days)
    low_influence_active:  480,
    low_influence_cold:    720,    // 30 days
    default:               336,
  },

  // Post-event follow-up windows (hours)
  follow_up_hours: {
    post_meeting:          48,
    open_loop:             72,    // 3 days
    intro_requested:       72,
    soft_interest:         72,
    commitment_pending:    120,   // 5 days
  },

  // State escalation from silence
  watch_multiplier:    1.0,   // silence >= threshold -> watch
  cooling_multiplier:  1.5,   // silence >= 1.5x -> cooling
  stalled_multiplier:  2.5,   // silence >= 2.5x -> stalled
  critical_multiplier: 4.0,   // silence >= 4x -> critical
};

// ─── Board cadence thresholds ─────────────────────────────────────────────────

export const BOARD_THRESHOLDS = {
  // Candidate outreach follow-up windows (hours)
  follow_up_hours: {
    first_touch_no_reply:   144,   // 6 days
    follow_up_1_no_reply:   144,
    post_meeting:           48,
    soft_interest:          72,
    commitment_pending:     120,
  },

  // Seat inactivity alert thresholds (hours)
  seat_inactivity: {
    high_priority_seat_alert: 168,   // 7 days — critical seat with no movement
    any_seat_no_progress:     336,   // 14 days
  },

  // Candidate state transitions
  cooling_after_hours:  240,   // 10 days no movement
  stalled_after_hours:  480,   // 20 days
};

// ─── Diligence issue SLA thresholds (hours to triage/resolve by severity) ────

export const DILIGENCE_THRESHOLDS = {
  // Hours before issue breaches SLA (no movement/resolution)
  sla_hours: {
    fatal:    8,     // same day triage
    critical: 48,    // 1-2 days
    material: 120,   // 3-5 days
    watch:    168,   // 7 days
    info:     336,   // flexible — 14 days
  },

  // Hours before escalating to alert even if assigned
  movement_alert_hours: {
    fatal:    8,
    critical: 48,
    material: 120,
    watch:    168,
    info:     336,
  },
};

// ─── Meeting timing thresholds ────────────────────────────────────────────────

export const MEETING_THRESHOLDS = {
  prep_due_before_hours:        24,   // prep should be ready 24h before
  prep_warning_before_hours:    12,   // warn if no prep 12h before
  follow_up_due_after_hours:    24,   // follow-up expected within 24h
  follow_up_stalled_after_hours:72,   // alert if no follow-up after 72h
  summary_due_after_hours:      4,    // summary expected within 4h of completion
};

// ─── Investor cadence thresholds (hours) ─────────────────────────────────────

export const INVESTOR_THRESHOLDS = {
  follow_up_hours: {
    post_intro_request:  96,    // 3-5 days
    post_first_touch:    144,   // 5-7 days
    post_memo_send:      96,    // 3-5 days
    post_meeting:        48,
    traction_update:     336,   // every 2 weeks minimum for active
  },

  // Silence thresholds per stage before risk escalates
  watch_silence_hours: {
    identified:    336,
    qualified:     240,
    intro_needed:  120,
    contacted:     120,
    responded:     72,
    meeting_set:   48,
    memo_sent:     96,
    diligence:     168,
    soft_circle:   168,
    committed:     336,
    passed:        null,   // no SLA on passed
  },
};

// ─── Approval timing thresholds ───────────────────────────────────────────────

export const APPROVAL_THRESHOLDS = {
  standard_sla_hours:       48,    // standard internal approval
  urgent_sla_hours:         24,    // important external messages
  stale_warning_hours:      48,    // warn after this
  very_stale_hours:         96,    // archive or require refresh
  source_changed_action:    'require_regenerate_or_ack',
};

// ─── Artifact staleness thresholds (hours) ────────────────────────────────────

export const ARTIFACT_THRESHOLDS = {
  stale_hours: {
    meeting_prep:             24,
    command_center_brief:     6,
    deal_summary:             48,
    board_outreach_draft:     72,
    investor_outreach_draft:  48,
    underwriting_commentary:  48,
    diligence_summary:        24,
    board_update:             48,
    memo_sections:            72,
    email_draft:              72,
    letter_draft:             72,
    default:                  24,
  },
};

// ─── Execution score penalty weights ──────────────────────────────────────────

export const EXECUTION_SCORE_PENALTIES = {
  critical_overdue_item:         20,   // per item, capped at 3
  stalled_active_deal:           15,
  high_influence_cooling_rel:    12,
  board_critical_seat_inactivity:12,
  fatal_issue_no_owner:          18,
  overdue_high_priority:          8,
  sla_breach_count_per:           3,   // per breach, after first
  max_total_penalty:             80,   // floor score at 20
};

// ─── Recovery severity config ─────────────────────────────────────────────────

export const RECOVERY_SEVERITY = {
  light_recovery:        { due_hours: 72,  priority: 'low' },
  standard_recovery:     { due_hours: 48,  priority: 'medium' },
  urgent_recovery:       { due_hours: 24,  priority: 'high' },
  critical_intervention: { due_hours: 8,   priority: 'critical' },
};

// ─── Convenience: full thresholds bundle ─────────────────────────────────────

export const ALL_THRESHOLDS = {
  task:        TASK_THRESHOLDS,
  deal_stage:  DEAL_STAGE_THRESHOLDS,
  relationship:RELATIONSHIP_THRESHOLDS,
  board:       BOARD_THRESHOLDS,
  diligence:   DILIGENCE_THRESHOLDS,
  meeting:     MEETING_THRESHOLDS,
  investor:    INVESTOR_THRESHOLDS,
  approval:    APPROVAL_THRESHOLDS,
  artifact:    ARTIFACT_THRESHOLDS,
  execution:   EXECUTION_SCORE_PENALTIES,
  recovery:    RECOVERY_SEVERITY,
};

export default ALL_THRESHOLDS;
