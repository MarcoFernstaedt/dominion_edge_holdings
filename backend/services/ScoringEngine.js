/**
 * ScoringEngine — deterministic, explainable scores for all platform entities.
 *
 * Rules:
 *  - Every score is 0-100, deterministic, reproducible.
 *  - Every score includes components, labels, and improvement actions.
 *  - AI may only add commentary on top of deterministic output.
 *  - Scores never depend on AI availability.
 */

// ─── Label thresholds (spec-aligned) ─────────────────────────────────────────
// 0–39 weak | 40–59 developing | 60–74 solid | 75–89 strong | 90–100 elite

export const SCORE_THRESHOLDS = [
  { min: 90, label: 'elite',      description: 'Exceptional — operating at peak standard' },
  { min: 75, label: 'strong',     description: 'Well-developed — minor gaps remain' },
  { min: 60, label: 'solid',      description: 'Functional — meaningful gaps to close' },
  { min: 40, label: 'developing', description: 'Early-stage — foundational work needed' },
  { min: 0,  label: 'weak',       description: 'Critical gaps — immediate attention required' },
];

export function labelFor(score) {
  return (SCORE_THRESHOLDS.find((t) => score >= t.min) ?? SCORE_THRESHOLDS[SCORE_THRESHOLDS.length - 1]).label;
}

export function thresholdFor(score) {
  return SCORE_THRESHOLDS.find((t) => score >= t.min) ?? SCORE_THRESHOLDS[SCORE_THRESHOLDS.length - 1];
}

export function isLowScore(score) {
  return score < 60; // weak or developing
}

// ─── Per-score implication map ────────────────────────────────────────────────

const SCORE_IMPLICATIONS = {
  thesis_clarity: {
    explanation:                'Measures how precisely the investment thesis defines the target, buy box, and rationale.',
    what_improves_this:         ['Define revenue buy box range', 'Add firm disqualifiers', 'Write fragmentation + why-now rationale', 'Set geography'],
    what_hurts_this:            ['Missing buy box', 'No disqualifiers', 'No written rationale', 'Generic industry selection'],
    recommended_next_move_if_low: 'Open thesis settings and complete buy box, add 2+ disqualifiers, and write the why-now rationale.',
  },
  board_readiness: {
    explanation:                'Measures progress toward a fully composed advisory board with active candidates and outreach.',
    what_improves_this:         ['Define all 6 seat types', 'Add 10+ candidates', 'Send outreach', 'Hold meetings', 'Secure commitments'],
    what_hurts_this:            ['Undefined seats', 'Empty pipeline', 'No outreach sent', 'No meetings held'],
    recommended_next_move_if_low: 'Define missing seat types and identify 2+ candidates per unfilled seat.',
  },
  target_fit: {
    explanation:                'Measures how well an acquisition target aligns to the current thesis parameters.',
    what_improves_this:         ['Revenue in buy box', 'Geography match', 'Industry match', 'Meets EBITDA floor', 'No disqualifiers triggered'],
    what_hurts_this:            ['Revenue out of range', 'Industry mismatch', 'Disqualifier triggered', 'Missing financial data'],
    recommended_next_move_if_low: 'Review the thesis parameters and confirm target financial data is complete.',
  },
  relationship_strength: {
    explanation:                'Measures engagement depth with a contact or seller based on interactions, recency, and responses.',
    what_improves_this:         ['Log recent touchpoints', 'Record responses', 'Hold meetings', 'Progress through engagement stages'],
    what_hurts_this:            ['No recent contact', 'No response recorded', 'Stale last contact', 'No meetings'],
    recommended_next_move_if_low: 'Log the most recent touchpoint and schedule the next contact.',
  },
  seller_likelihood: {
    explanation:                'Measures signals that a seller may be open to a transaction in the near term.',
    what_improves_this:         ['Record motivation signals', 'Identify timing signals', 'Log positive responses', 'Advance engagement stage'],
    what_hurts_this:            ['No motivation on record', 'No engagement', 'No timing signals', 'Stale contact'],
    recommended_next_move_if_low: 'Research and log at least one seller motivation signal.',
  },
  deal_quality: {
    explanation:                'Measures overall deal viability based on financial completeness, stage, and risk profile.',
    what_improves_this:         ['Complete financials', 'Advance stage', 'Reduce risk flags', 'Log LOI or PSA progress'],
    what_hurts_this:            ['Incomplete financials', 'High risk flags', 'Deal stalled in early stage'],
    recommended_next_move_if_low: 'Identify and complete the next missing financial field.',
  },
  underwriting_strength: {
    explanation:                'Measures how well a deal underwrites based on DSCR, structure viability, and financial completeness.',
    what_improves_this:         ['Achieve DSCR >= 1.25x', 'Complete financials', 'Resolve risk flags', 'Confirm working capital'],
    what_hurts_this:            ['DSCR below 1.25x', 'Missing financials', 'Multiple risk flags', 'Customer concentration'],
    recommended_next_move_if_low: 'Complete financial intake and run underwriting structure review.',
  },
  diligence_completeness: {
    explanation:                'Measures how thoroughly diligence has been started, logged, and cleared across all categories.',
    what_improves_this:         ['Start all diligence categories', 'Log issues', 'Resolve fatal issues', 'Clear lender blockers'],
    what_hurts_this:            ['Diligence categories not started', 'Fatal issues open', 'Lender blockers unresolved'],
    recommended_next_move_if_low: 'Start diligence review on the highest-weight uncompleted category.',
  },
  lender_readiness: {
    explanation:                'Measures readiness to submit a deal package to a lender.',
    what_improves_this:         ['Complete financial package', 'Achieve underwriting score >= 60', 'Clear lender blockers', 'Organize documents', 'Write executive summary'],
    what_hurts_this:            ['Incomplete financial package', 'Open lender blockers', 'No executive summary', 'Weak underwriting'],
    recommended_next_move_if_low: 'Resolve open lender blockers and complete the financial package.',
  },
  investor_readiness: {
    explanation:                'Measures readiness to present a deal or opportunity to an investor.',
    what_improves_this:         ['Complete thesis', 'Advance board progress', 'Complete deal underwriting', 'Prepare memo or pitch outline'],
    what_hurts_this:            ['Weak thesis', 'No board progress', 'Incomplete financials', 'No memo prepared'],
    recommended_next_move_if_low: 'Complete thesis documentation and draft the investor summary memo.',
  },
  execution_score: {
    explanation:                'Measures consistency and quality of task execution across active priorities.',
    what_improves_this:         ['Complete high-priority tasks on time', 'Reduce overdue items', 'Log completions'],
    what_hurts_this:            ['Overdue tasks', 'Stalled entities', 'Low completion rate', 'No recent activity'],
    recommended_next_move_if_low: 'Pick one overdue high-priority task and complete it today.',
  },
  momentum_score: {
    explanation:                'Measures forward progress velocity across active deals, outreach, and board building.',
    what_improves_this:         ['Log new activities', 'Advance deal stages', 'Send outreach', 'Hold meetings'],
    what_hurts_this:            ['No new activities', 'Deals stalled', 'No outreach this week', 'No meetings this month'],
    recommended_next_move_if_low: 'Identify one deal or contact that is stalled and take a concrete next step.',
  },
  discipline_score: {
    explanation:                'Measures consistency of structured execution habits over time.',
    what_improves_this:         ['Log daily activities', 'Maintain consistent outreach cadence', 'Reduce stall periods'],
    what_hurts_this:            ['Long gaps in activity', 'Inconsistent logging', 'Repeated overdue items'],
    recommended_next_move_if_low: 'Log at least one activity per day for the next 5 days.',
  },
};

function _implications(scoreName, value) {
  const imp = SCORE_IMPLICATIONS[scoreName];
  if (!imp) return {};
  return {
    explanation:                  imp.explanation,
    what_improves_this:           imp.what_improves_this,
    what_hurts_this:              imp.what_hurts_this,
    recommended_next_move_if_low: isLowScore(value) ? imp.recommended_next_move_if_low : null,
  };
}

function scoreResult(name, components, improvements = [], staleAt = null) {
  const weights = Object.values(components).reduce((s, c) => s + c.weight, 0);
  const earned  = Object.values(components).reduce((s, c) => s + (c.met ? c.weight : 0), 0);
  const value   = weights > 0 ? Math.round((earned / weights) * 100) : 0;
  const thresh  = thresholdFor(value);
  // Canonical score name without _score suffix for implication lookup
  const implKey = name.replace(/_score$/, '');
  return {
    score_name:                   name,
    score_value:                  value,
    score_label:                  thresh.label,
    score_label_description:      thresh.description,
    score_components:             components,
    improvement_actions:          improvements.filter(Boolean),
    stale_at:                     staleAt,
    calculated_at:                new Date().toISOString(),
    ..._implications(implKey, value),
  };
}

// ─── thesis_clarity_score ─────────────────────────────────────────────────────

export function thesisClarityScore(thesis = {}) {
  const c = {
    industry_specificity: { weight: 20, met: Boolean(thesis.industry), label: 'Industry selected' },
    geo_specificity:      { weight: 10, met: Boolean(thesis.geography), label: 'Target geography set' },
    buy_box_clarity:      { weight: 25, met: Boolean(thesis.buy_box_min_revenue && thesis.buy_box_max_revenue), label: 'Buy box with revenue range defined' },
    disqualifier_clarity: { weight: 15, met: Array.isArray(thesis.disqualifiers) && thesis.disqualifiers.length >= 2, label: 'At least 2 disqualifiers defined' },
    market_rationale:     { weight: 15, met: Boolean(thesis.fragmentation_rationale), label: 'Fragmentation rationale written' },
    operator_rationale:   { weight: 15, met: Boolean(thesis.why_now_rationale), label: 'Why-now rationale written' },
  };
  const improvements = [
    !c.buy_box_clarity.met      && 'Define minimum and maximum revenue range in buy box',
    !c.disqualifier_clarity.met && 'Add at least 2 firm disqualifiers (e.g. capex-heavy, regulatory-intensive)',
    !c.market_rationale.met     && 'Write fragmentation rationale (why this market fragments well)',
    !c.operator_rationale.met   && 'Write why-now rationale (why acquire now vs. later)',
  ];
  return scoreResult('thesis_clarity_score', c, improvements);
}

// ─── board_readiness_score ────────────────────────────────────────────────────

export function boardReadinessScore(board = {}) {
  const { seats = [], candidates = [], outreach_sent = 0, meetings_held = 0, commitments = 0, industry_veteran_prioritized = false } = board;
  const c = {
    seat_definition_completeness: { weight: 20, met: seats.length >= 6, label: '6+ seat definitions' },
    candidate_volume:             { weight: 15, met: candidates.length >= 10, label: '10+ candidates in pipeline' },
    seat_coverage:                { weight: 10, met: _uniqueSeatsWithCandidates(seats, candidates) >= 4, label: '4+ seats have candidates' },
    outreach_progress:            { weight: 20, met: outreach_sent >= 10, label: '10+ outreach messages sent' },
    meeting_progress:             { weight: 15, met: meetings_held >= 2, label: '2+ meetings held' },
    commitment_count:             { weight: 10, met: commitments >= 1, label: 'At least 1 commitment' },
    industry_veteran_progress:    { weight: 10, met: industry_veteran_prioritized, label: 'Industry veteran prioritized' },
  };
  const improvements = [
    !c.seat_definition_completeness.met && 'Define all 6 board seat roles (operator, advisor, investor, legal, industry veteran, independent)',
    !c.candidate_volume.met             && 'Add more candidates to pipeline (target 10+ to ensure selection quality)',
    !c.outreach_progress.met            && `Send more outreach — at ${outreach_sent}, target is 10`,
    !c.meeting_progress.met             && 'Schedule and hold initial board candidate meetings',
    !c.industry_veteran_progress.met    && 'Mark industry veteran seat as priority and advance top candidate',
  ];
  return scoreResult('board_readiness_score', c, improvements);
}

// ─── target_fit_score ─────────────────────────────────────────────────────────

export function targetFitScore(target = {}, thesis = {}) {
  const industryMatch  = thesis.industry ? (target.industry ?? '').toLowerCase().includes(thesis.industry.toLowerCase()) : false;
  const geoMatch       = thesis.geography ? (target.geography ?? '').toLowerCase().includes(thesis.geography.toLowerCase()) : false;
  const sizeMatch      = _sizeInBuyBox(target.revenue, thesis);
  const c = {
    industry_fit:        { weight: 20, met: industryMatch, label: 'Industry matches thesis' },
    geo_fit:             { weight: 10, met: geoMatch,      label: 'Geography matches thesis' },
    size_fit:            { weight: 20, met: sizeMatch,     label: 'Revenue within buy box' },
    seller_signal_score: { weight: 15, met: (target.seller_signal_score ?? 0) >= 50, label: 'Seller signal score >= 50' },
    recurring_revenue:   { weight: 10, met: Boolean(target.has_recurring_revenue), label: 'Has recurring revenue' },
    platform_potential:  { weight: 15, met: Boolean(target.platform_potential), label: 'Platform potential identified' },
    operational_fit:     { weight: 10, met: Boolean(target.operational_fit), label: 'Operationally manageable' },
  };
  const improvements = [
    !c.industry_fit.met    && `Verify target industry aligns with thesis industry: "${thesis.industry}"`,
    !c.size_fit.met        && `Target revenue $${target.revenue} may be outside buy box ($${thesis.buy_box_min_revenue} – $${thesis.buy_box_max_revenue})`,
    !c.seller_signal_score.met && 'Research seller signals (retirement, owner dependence, stagnant growth)',
  ];
  return scoreResult('target_fit_score', c, improvements);
}

// ─── relationship_strength_score ──────────────────────────────────────────────

export function relationshipStrengthScore(rel = {}) {
  const daysSince = rel.days_since_contact ?? 999;
  const c = {
    recency:         { weight: 20, met: daysSince <= 14,              label: 'Contact within 14 days' },
    reply_rate:      { weight: 15, met: (rel.reply_rate ?? 0) >= 0.3, label: 'Reply rate >= 30%' },
    meeting_history: { weight: 15, met: (rel.meeting_count ?? 0) >= 1, label: 'At least 1 meeting held' },
    warmth:          { weight: 15, met: ['warm', 'hot'].includes(rel.warmth_level), label: 'Warm or hot status' },
    influence:       { weight: 10, met: (rel.influence_score ?? 0) >= 50, label: 'Influence score >= 50' },
    trust_indicators: { weight: 15, met: (rel.intro_count ?? 0) >= 1 || (rel.referral_count ?? 0) >= 1, label: 'Has given intro or referral' },
    intro_power:     { weight: 10, met: Boolean(rel.high_value_intro), label: 'Can provide high-value intro' },
  };
  const improvements = [
    daysSince > 14 && `Last contact ${daysSince} days ago — re-engage now`,
    !c.meeting_history.met && 'No meetings held — schedule initial call',
    !c.warmth.met          && 'Relationship warmth is cold/neutral — increase touch frequency',
  ];
  return scoreResult('relationship_strength_score', c, improvements);
}

// ─── seller_likelihood_score ──────────────────────────────────────────────────

export function sellerLikelihoodScore(target = {}) {
  const c = {
    retirement_signal:       { weight: 20, met: Boolean(target.retirement_signal),       label: 'Retirement or exit signal detected' },
    owner_dependence_signal: { weight: 15, met: Boolean(target.owner_dependence_signal), label: 'Owner-dependent operations' },
    outdated_presence:       { weight: 10, met: Boolean(target.outdated_web_presence),   label: 'Outdated or neglected web presence' },
    review_decline:          { weight: 10, met: Boolean(target.review_decline_signal),   label: 'Declining review trend' },
    hiring_slowdown:         { weight: 10, met: Boolean(target.hiring_slowdown_signal),  label: 'Hiring slowdown detected' },
    response_behavior:       { weight: 15, met: target.outreach_response === 'positive', label: 'Positive response to outreach' },
    years_in_business:       { weight: 20, met: (target.years_in_business ?? 0) >= 15,   label: '15+ years in business (maturity signal)' },
  };
  const improvements = [
    !c.retirement_signal.met  && 'Research owner age, LinkedIn activity, and succession indicators',
    !c.response_behavior.met  && 'Send first-touch outreach and track response',
    !c.years_in_business.met  && 'Verify years in business via public records',
  ];
  return scoreResult('seller_likelihood_score', c, improvements);
}

// ─── deal_quality_score ───────────────────────────────────────────────────────

export function dealQualityScore(deal = {}) {
  const fatalCount = (deal.fatal_flags ?? []).length;
  const c = {
    fit:                 { weight: 15, met: (deal.target_fit_score ?? 0) >= 60, label: 'Target fit score >= 60' },
    financial_quality:   { weight: 20, met: Boolean(deal.financials_complete),  label: 'Financials sufficiently complete' },
    responsiveness:      { weight: 10, met: Boolean(deal.seller_responsive),    label: 'Seller responsive' },
    document_readiness:  { weight: 10, met: Boolean(deal.documents_received),   label: 'Key documents received' },
    no_fatal_flags:      { weight: 25, met: fatalCount === 0,                   label: 'No fatal flags' },
    stage_velocity:      { weight: 10, met: (deal.days_in_stage ?? 999) <= 30,  label: 'Stage velocity < 30 days' },
    structure_viability: { weight: 10, met: Boolean(deal.structure_viable),     label: 'Structure scenarios viable' },
  };
  const improvements = [
    fatalCount > 0         && `${fatalCount} fatal flag(s) active — resolve or close deal`,
    !c.financial_quality.met && 'Request and complete financial intake (3 years P&L, balance sheet)',
    !c.stage_velocity.met  && `Deal stuck in current stage ${deal.days_in_stage} days — drive next step`,
    !c.structure_viability.met && 'Run underwriting scenarios to confirm structure viability',
  ];
  return scoreResult('deal_quality_score', c, improvements);
}

// ─── execution_score ──────────────────────────────────────────────────────────

export function executionScore(execution = {}) {
  const c = {
    required_tasks_on_time: { weight: 25, met: (execution.required_tasks_on_time_pct ?? 0) >= 80, label: '80%+ required tasks completed on time' },
    follow_up_compliance:   { weight: 20, met: (execution.followup_compliance_pct ?? 0) >= 75,    label: '75%+ follow-ups completed' },
    proof_completion_rate:  { weight: 25, met: (execution.proof_completion_rate ?? 0) >= 80,      label: '80%+ tasks with proof submitted' },
    no_stalled_burden:      { weight: 15, met: (execution.stalled_count ?? 0) <= 2,               label: '2 or fewer stalled items' },
    weekly_commitments:     { weight: 15, met: (execution.weekly_commitment_pct ?? 0) >= 70,      label: '70%+ weekly commitments kept' },
  };
  const improvements = [
    !c.required_tasks_on_time.met && `On-time rate is ${execution.required_tasks_on_time_pct ?? 0}% — review overdue task list`,
    !c.proof_completion_rate.met  && `Proof rate is ${execution.proof_completion_rate ?? 0}% — submit outstanding proof`,
    (execution.stalled_count ?? 0) > 2 && `${execution.stalled_count} stalled items — assign owners and set deadlines`,
  ];
  return scoreResult('execution_score', c, improvements);
}

// ─── momentum_score ───────────────────────────────────────────────────────────

export function momentumScore(momentum = {}) {
  const c = {
    activity_7d:        { weight: 20, met: (momentum.activity_7d ?? 0) >= 5,    label: '5+ activities in last 7 days' },
    activity_14d:       { weight: 15, met: (momentum.activity_14d ?? 0) >= 10,  label: '10+ activities in last 14 days' },
    deal_movement:      { weight: 20, met: Boolean(momentum.deal_stage_change_7d), label: 'Deal stage changed in last 7 days' },
    relationship_touches: { weight: 15, met: (momentum.relationship_touches_7d ?? 0) >= 3, label: '3+ relationship touches in 7 days' },
    board_progress:     { weight: 15, met: Boolean(momentum.board_activity_7d), label: 'Board activity this week' },
    no_overdue_burden:  { weight: 15, met: (momentum.overdue_count ?? 0) <= 1,  label: '1 or fewer overdue items' },
  };
  const improvements = [
    (momentum.activity_7d ?? 0) < 5     && 'Low activity — schedule outreach and follow-up tasks for this week',
    !c.deal_movement.met                 && 'No deal stage movement this week — identify and execute next step',
    (momentum.overdue_count ?? 0) > 1   && `${momentum.overdue_count} overdue items dragging momentum — clear them first`,
  ];
  return scoreResult('momentum_score', c, improvements);
}

// ─── discipline_score ─────────────────────────────────────────────────────────

export function disciplineScore(discipline = {}) {
  const c = {
    daily_completion:     { weight: 25, met: (discipline.daily_completion_rate ?? 0) >= 70, label: '70%+ daily tasks completed' },
    weekly_promises_kept: { weight: 25, met: (discipline.weekly_promises_pct ?? 0) >= 75,   label: '75%+ weekly commitments kept' },
    followup_punctuality: { weight: 20, met: (discipline.followup_on_time_pct ?? 0) >= 80,  label: '80%+ follow-ups on time' },
    proof_quality:        { weight: 15, met: (discipline.high_quality_proof_pct ?? 0) >= 60, label: '60%+ proof rated high quality' },
    stalled_recovery:     { weight: 15, met: (discipline.stalled_recovery_rate ?? 0) >= 50,  label: '50%+ stalled items recovered within 7 days' },
  };
  const improvements = [
    !c.daily_completion.met     && `Daily completion at ${discipline.daily_completion_rate ?? 0}% — set a daily task ritual`,
    !c.weekly_promises_kept.met && 'Track commitments made vs. kept weekly',
    !c.followup_punctuality.met && 'Follow-up punctuality low — use automated reminders',
  ];
  return scoreResult('discipline_score', c, improvements);
}

// ─── underwriting_strength_score ─────────────────────────────────────────────

export function underwritingStrengthScore(uw = {}) {
  const riskFlagCount = (uw.risk_flags ?? []).length;
  const c = {
    dscr_strength:          { weight: 25, met: (uw.dscr ?? 0) >= 1.25,         label: 'DSCR >= 1.25x' },
    structure_viability:    { weight: 20, met: Boolean(uw.structure_viable),    label: 'At least one viable structure' },
    financial_completeness: { weight: 20, met: Boolean(uw.financials_complete), label: 'Financials complete for underwriting' },
    low_risk_flag_burden:   { weight: 15, met: riskFlagCount <= 1,              label: '1 or fewer risk flags' },
    working_capital:        { weight: 10, met: Boolean(uw.working_capital_adequate), label: 'Working capital adequate' },
    concentration_quality:  { weight: 10, met: !uw.high_customer_concentration, label: 'No high customer concentration' },
  };
  const improvements = [
    (uw.dscr ?? 0) < 1.25     && `DSCR ${uw.dscr ?? 'N/A'} is below 1.25x threshold — adjust structure or price`,
    !c.financial_completeness.met && 'Complete financial intake before underwriting',
    riskFlagCount > 1         && `${riskFlagCount} risk flags active — review and remediate`,
    uw.high_customer_concentration && 'Address customer concentration risk in structure',
  ];
  return scoreResult('underwriting_strength_score', c, improvements);
}

// ─── diligence_completeness_score ────────────────────────────────────────────

export function diligenceCompletenessScore(diligence = {}) {
  const { categories = {} } = diligence;
  // Weighted categories per spec
  const CATEGORY_WEIGHTS = {
    financial:         20,
    legal:             15,
    compliance:        12,
    licensing:         12,
    working_capital:   10,
    customer:          10,
    operational:       8,
    tax:               5,
    hr:                4,
    insurance:         4,
  };
  const components = {};
  let totalWeight = 0;
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const catData = categories[cat] ?? {};
    const met = Boolean(catData.review_started && catData.issues_logged !== undefined && !catData.fatals_present);
    components[`${cat}_category`] = { weight, met, label: `${cat}: started + issues logged + no fatals` };
    totalWeight += weight;
  }
  const fatalIssues  = diligence.fatal_issue_count  ?? 0;
  const lenderBlocks = diligence.lender_blocker_count ?? 0;
  components['no_fatal_issues']    = { weight: 5, met: fatalIssues === 0,  label: 'No fatal diligence issues' };
  components['no_lender_blockers'] = { weight: 5, met: lenderBlocks === 0, label: 'No lender blockers outstanding' };

  const improvements = [
    fatalIssues > 0  && `${fatalIssues} fatal issue(s) — must resolve before financing`,
    lenderBlocks > 0 && `${lenderBlocks} lender blocker(s) — resolve before lender submission`,
    ...Object.entries(components)
      .filter(([, c]) => !c.met)
      .slice(0, 3)
      .map(([k]) => `Start and advance diligence category: ${k.replace('_category', '')}`),
  ];
  return scoreResult('diligence_completeness_score', components, improvements);
}

// ─── lender_readiness_score ───────────────────────────────────────────────────

export function lenderReadinessScore(data = {}) {
  const c = {
    financial_package:     { weight: 25, met: (data.financial_package_completeness ?? 0) >= 80, label: 'Financial package 80%+ complete' },
    underwriting_strength: { weight: 20, met: (data.underwriting_score ?? 0) >= 60,             label: 'Underwriting score >= 60' },
    diligence_completeness:{ weight: 20, met: (data.diligence_score ?? 0) >= 65,                label: 'Diligence score >= 65' },
    no_lender_blockers:    { weight: 20, met: (data.lender_blocker_count ?? 0) === 0,           label: 'No open lender blockers' },
    document_quality:      { weight: 10, met: Boolean(data.documents_organized),               label: 'Documents organized and labeled' },
    narrative_readiness:   { weight: 5,  met: Boolean(data.executive_summary_exists),          label: 'Executive summary exists' },
  };
  const improvements = [
    !c.financial_package.met     && `Financial package ${data.financial_package_completeness ?? 0}% — complete remaining items`,
    (data.lender_blocker_count ?? 0) > 0 && `${data.lender_blocker_count} lender blocker(s) open — resolve before submission`,
    !c.narrative_readiness.met   && 'Write executive summary for lender package',
  ];
  return scoreResult('lender_readiness_score', c, improvements);
}

// ─── investor_readiness_score ─────────────────────────────────────────────────

export function investorReadinessScore(data = {}) {
  const c = {
    thesis_clarity:       { weight: 20, met: (data.thesis_clarity_score  ?? 0) >= 60, label: 'Thesis clarity score >= 60' },
    board_progress:       { weight: 15, met: (data.board_readiness_score ?? 0) >= 40, label: 'Board readiness score >= 40' },
    deal_underwriting:    { weight: 20, met: (data.underwriting_score    ?? 0) >= 60, label: 'Underwriting score >= 60' },
    diligence_started:    { weight: 15, met: (data.diligence_score       ?? 0) >= 40, label: 'Diligence completeness >= 40' },
    memo_or_pitch_exists: { weight: 15, met: Boolean(data.memo_exists || data.pitch_deck_exists), label: 'Investor memo or pitch deck outline exists' },
    financials_complete:  { weight: 10, met: Boolean(data.financials_complete), label: 'Financial package complete enough for review' },
    executive_summary:    { weight: 5,  met: Boolean(data.executive_summary_exists), label: 'Executive summary written' },
  };
  const improvements = [
    !c.thesis_clarity.met       && 'Improve thesis clarity score to 60+ before investor outreach',
    !c.memo_or_pitch_exists.met && 'Create an investor memo or pitch deck outline',
    !c.financials_complete.met  && 'Complete financial intake before investor conversations',
    !c.executive_summary.met    && 'Write executive summary',
  ];
  return scoreResult('investor_readiness_score', c, improvements);
}

// ─── Batch score calculation ──────────────────────────────────────────────────

/**
 * Calculate all scores relevant to a deal in one call.
 */
export function dealScores(deal = {}, { thesis = {}, diligence = {}, underwriting = {}, execution = {} } = {}) {
  return {
    deal_quality:           dealQualityScore(deal),
    target_fit:             targetFitScore(deal.target ?? deal, thesis),
    seller_likelihood:      sellerLikelihoodScore(deal.target ?? deal),
    underwriting_strength:  underwritingStrengthScore(underwriting),
    diligence_completeness: diligenceCompletenessScore(diligence),
    lender_readiness:       lenderReadinessScore({
      financial_package_completeness: deal.financial_package_completeness,
      underwriting_score:             underwriting.score,
      diligence_score:                diligence.score,
      lender_blocker_count:           diligence.lender_blocker_count,
      documents_organized:            deal.documents_organized,
      executive_summary_exists:       deal.executive_summary_exists,
    }),
  };
}

/**
 * Calculate all scores relevant to firm-level health.
 */
export function firmScores(data = {}) {
  return {
    thesis_clarity:       thesisClarityScore(data.thesis ?? {}),
    board_readiness:      boardReadinessScore(data.board ?? {}),
    execution:            executionScore(data.execution ?? {}),
    momentum:             momentumScore(data.momentum ?? {}),
    discipline:           disciplineScore(data.discipline ?? {}),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _sizeInBuyBox(revenue, thesis) {
  if (!revenue || !thesis.buy_box_min_revenue || !thesis.buy_box_max_revenue) return false;
  return revenue >= thesis.buy_box_min_revenue && revenue <= thesis.buy_box_max_revenue;
}

function _uniqueSeatsWithCandidates(seats, candidates) {
  const covered = new Set(candidates.map((c) => c.target_seat_key).filter(Boolean));
  return seats.filter((s) => covered.has(s.seat_key)).length;
}

export default {
  thesisClarityScore, boardReadinessScore, targetFitScore, relationshipStrengthScore,
  sellerLikelihoodScore, dealQualityScore, executionScore, momentumScore, disciplineScore,
  underwritingStrengthScore, diligenceCompletenessScore, lenderReadinessScore,
  investorReadinessScore,
  dealScores, firmScores, labelFor, thresholdFor, isLowScore, SCORE_THRESHOLDS,
};
