/**
 * NetworkAlerts
 *
 * Deterministic alert generator for relationship leverage gaps,
 * board seat risks, investor intro opportunities, and follow-up timing.
 *
 * Alerts are used by:
 *  - Command Center (top-priority surface)
 *  - Next-action engine weighting
 *  - Board seat health monitoring
 *  - Investor outreach prioritization
 *
 * All alerts are deterministic. No AI logic here.
 */

// ─── Alert types ───────────────────────────────────────────────────────────────

export const ALERT_TYPES = {
  HIGH_VALUE_RELATIONSHIP_COOLING:              'high_value_relationship_cooling',
  BEST_WARM_INTRO_UNUSED:                       'best_warm_intro_path_available_but_unused',
  STRONG_INVESTOR_FIT_OPEN_INTRO:               'strong_investor_fit_with_open_intro_path',
  STRONG_BOARD_CANDIDATE_NO_FOLLOW_UP:          'strong_board_candidate_with_no_follow_up',
  ADVOCATE_NOT_TOUCHED:                         'advocate_not_touched_in_too_long',
  SEAT_DEPENDENT_ONE_WEAK_CANDIDATE:            'seat_dependent_on_one_weak_candidate',
  CAPITAL_CONNECTOR_WEAK_INVESTOR_READY:        'capital_connector_seat_weak_while_investor_readiness_rising',
  INDUSTRY_VETERAN_WEAK:                        'industry_veteran_seat_weak_impacting_credibility',
  NO_INTRO_PATH_HIGH_FIT_INVESTOR:              'no_intro_path_to_high_fit_investor',
  STALLED_RELATIONSHIP_HIGH_LEVERAGE:           'stalled_relationship_high_leverage_node',
  BOARD_SEAT_CRITICAL_NO_PROGRESS:              'board_seat_critical_no_progress',
};

export const ALERT_SEVERITIES = ['info', 'moderate', 'high', 'critical'];

// ─── Thresholds ────────────────────────────────────────────────────────────────

const ALERT_THRESHOLDS = {
  high_value_cooling_days:      14,   // days since touch for high-influence contact
  advocate_not_touched_days:    21,   // advocate should be touched every 3 weeks
  board_no_follow_up_days:       7,   // strong candidate with no follow-up
  seat_no_progress_critical_days:7,
  investor_open_intro_unused_days:14, // open intro path not actioned in 14 days
  min_influence_score_for_alert: 60,  // influence ≥ 60 to trigger high-value alert
  min_fit_for_board_alert:       60,  // fit ≥ 60 to surface "strong candidate" alert
  min_fit_for_investor_alert:    65,  // investor fit ≥ 65 for priority alert
  min_intro_score_for_open:      40,  // intro score ≥ 40 = "open path"
};

// ─── Main alert generator ─────────────────────────────────────────────────────

/**
 * Generate all network alerts from the current data state.
 *
 * @param {object} ctx
 * @param {object[]} ctx.contacts           - enriched contacts (with leverage_score, is_advocate, etc.)
 * @param {object[]} ctx.boardCandidates    - scored board candidates
 * @param {object[]} ctx.boardSeats         - analyzed seats from BoardSeatEngine
 * @param {object[]} ctx.investors          - scored investors
 * @param {object}   ctx.credibilityIndex   - result from CredibilityIndex.calcCredibilityIndex
 * @param {object[]} ctx.introPathResults   - [{ source_id, target_id, best_path_score, target_type }]
 *
 * @returns {{ alerts: object[], critical_count: number, high_count: number }}
 */
export function generateNetworkAlerts(ctx = {}) {
  const {
    contacts        = [],
    boardCandidates = [],
    boardSeats      = [],
    investors       = [],
    credibilityIndex = {},
    introPathResults = [],
  } = ctx;

  const alerts = [];

  // ── 1. High-value relationship cooling ────────────────────────────────────
  for (const c of contacts) {
    const influence = c.influence_score ?? c.influenceScore ?? 0;
    if (influence < ALERT_THRESHOLDS.min_influence_score_for_alert) continue;

    const days = c.days_since_last_touch ?? _daysSince(c.lastInteractionAt ?? c.last_interaction_at);
    if (days >= ALERT_THRESHOLDS.high_value_cooling_days) {
      alerts.push(_alert({
        type:       ALERT_TYPES.HIGH_VALUE_RELATIONSHIP_COOLING,
        severity:   days > 30 ? 'high' : 'moderate',
        contact_id: c.id,
        message:    `${c.firstName ?? c.name ?? 'Contact'} (influence: ${Math.round(influence)}) hasn't been touched in ${Math.round(days)} days.`,
        entity_type:'contact',
        entity_id:  c.id,
        context:    { days, influence_score: influence, relationship_state: c.relationship_state },
      }));
    }
  }

  // ── 2. Best warm intro path available but unused ──────────────────────────
  for (const path of introPathResults) {
    if ((path.best_path_score ?? 0) < ALERT_THRESHOLDS.min_intro_score_for_open) continue;
    const daysUnused = path.days_since_last_attempt ?? 999;
    if (daysUnused < ALERT_THRESHOLDS.investor_open_intro_unused_days) continue;

    alerts.push(_alert({
      type:      ALERT_TYPES.BEST_WARM_INTRO_UNUSED,
      severity:  path.best_path_score >= 70 ? 'high' : 'moderate',
      message:   `Strong intro path to ${path.target_name ?? path.target_id} (score: ${path.best_path_score}) has not been used.`,
      entity_type: path.target_type ?? 'contact',
      entity_id: path.target_id,
      context:   { path_score: path.best_path_score, target_type: path.target_type },
    }));
  }

  // ── 3. Strong investor fit with open intro path ───────────────────────────
  for (const inv of investors) {
    const fit   = inv.fit_score ?? 0;
    const intro = inv.intro_path_score ?? inv.introPathScore ?? 0;
    if (fit < ALERT_THRESHOLDS.min_fit_for_investor_alert) continue;
    if (intro < ALERT_THRESHOLDS.min_intro_score_for_open) continue;

    const stage = inv.investorStage ?? inv.stage ?? inv.relationshipStage ?? 'identified';
    if (['contacted', 'responded', 'meeting_set', 'memo_sent', 'diligence', 'soft_circle', 'committed', 'passed'].includes(stage)) continue;

    alerts.push(_alert({
      type:      ALERT_TYPES.STRONG_INVESTOR_FIT_OPEN_INTRO,
      severity:  fit >= 80 ? 'high' : 'moderate',
      message:   `${inv.name} — fit: ${fit}, intro path: ${intro}. Strong fit with open intro path not yet activated.`,
      entity_type:'investor',
      entity_id: inv.id,
      context:   { fit_score: fit, intro_path_score: intro, stage },
    }));
  }

  // ── 4. Strong board candidate with no follow-up ───────────────────────────
  for (const c of boardCandidates) {
    const fit  = c.fit_score ?? 0;
    if (fit < ALERT_THRESHOLDS.min_fit_for_board_alert) continue;
    if (['confirmed', 'passed', 'negotiating'].includes(c.status ?? '')) continue;

    const days = c.days_since_last_progress ?? _daysSince(c.last_outreach_at ?? c.updatedAt);
    if (days >= ALERT_THRESHOLDS.board_no_follow_up_days) {
      alerts.push(_alert({
        type:      ALERT_TYPES.STRONG_BOARD_CANDIDATE_NO_FOLLOW_UP,
        severity:  fit >= 75 ? 'high' : 'moderate',
        message:   `${c.name ?? 'Candidate'} (fit: ${fit}) has had no follow-up in ${Math.round(days)} days.`,
        entity_type:'board_candidate',
        entity_id: c.id,
        context:   { fit_score: fit, days, seat_type: c.seat_type ?? c.seatType },
      }));
    }
  }

  // ── 5. Advocate not touched in too long ───────────────────────────────────
  for (const c of contacts) {
    if (!c.is_advocate) continue;
    const days = c.days_since_last_touch ?? _daysSince(c.lastInteractionAt ?? c.last_interaction_at);
    if (days >= ALERT_THRESHOLDS.advocate_not_touched_days) {
      alerts.push(_alert({
        type:      ALERT_TYPES.ADVOCATE_NOT_TOUCHED,
        severity:  days > 45 ? 'high' : 'moderate',
        message:   `Advocate ${c.firstName ?? c.name ?? 'Contact'} hasn't been touched in ${Math.round(days)} days.`,
        entity_type:'contact',
        entity_id:  c.id,
        context:   { days, is_advocate: true },
      }));
    }
  }

  // ── 6. Seat dependent on one weak candidate ───────────────────────────────
  for (const seat of boardSeats) {
    const viable  = seat.viable_candidate_count ?? 0;
    const total   = seat.candidate_count ?? 0;
    const health  = seat.health_state ?? 'empty';
    if (['secured', 'empty'].includes(health)) continue;
    if (viable === 1 && total <= 2) {
      alerts.push(_alert({
        type:      ALERT_TYPES.SEAT_DEPENDENT_ONE_WEAK_CANDIDATE,
        severity:  seat.industry_veteran_boost ? 'high' : 'moderate',
        message:   `${seat.seat_type} seat has only one viable candidate. Pipeline is fragile.`,
        entity_type:'board_seat',
        entity_id:  seat.id ?? seat.seat_type,
        context:   { seat_type: seat.seat_type, viable_count: viable, total_count: total },
      }));
    }
  }

  // ── 7. Capital connector weak while investor readiness rising ─────────────
  const ccSeat = boardSeats.find(
    (s) => (s.seat_type ?? s.seatType) === 'capital_connector'
  );
  const credScore = credibilityIndex?.score ?? 0;
  if (ccSeat && ['empty', 'weak'].includes(ccSeat.health_state) && credScore >= 50) {
    alerts.push(_alert({
      type:     ALERT_TYPES.CAPITAL_CONNECTOR_WEAK_INVESTOR_READY,
      severity: 'high',
      message:  `Capital connector seat is ${ccSeat.health_state} while firm credibility (${credScore}) is building — investor intro capacity is limited.`,
      entity_type:'board_seat',
      entity_id:  ccSeat.id ?? 'capital_connector',
      context:  { credibility_score: credScore, seat_health: ccSeat.health_state },
    }));
  }

  // ── 8. Industry veteran weak — credibility transfer limited ──────────────
  const ivSeat = boardSeats.find(
    (s) => (s.seat_type ?? s.seatType) === 'industry_veteran'
  );
  if (ivSeat && ['empty', 'weak'].includes(ivSeat.health_state)) {
    alerts.push(_alert({
      type:     ALERT_TYPES.INDUSTRY_VETERAN_WEAK,
      severity: 'critical',
      message:  `Industry veteran seat is ${ivSeat.health_state}. Credibility transfer to bankers and investors is limited until this seat progresses.`,
      entity_type:'board_seat',
      entity_id:  ivSeat.id ?? 'industry_veteran',
      context:  { seat_health: ivSeat.health_state },
    }));
  }

  // ── 9. No intro path to high-fit investor ─────────────────────────────────
  for (const inv of investors) {
    const fit   = inv.fit_score ?? 0;
    const intro = inv.intro_path_score ?? 0;
    const stage = inv.investorStage ?? inv.stage ?? inv.relationshipStage ?? 'identified';
    if (fit < 75) continue;
    if (['contacted', 'responded', 'meeting_set', 'diligence', 'soft_circle', 'committed', 'passed'].includes(stage)) continue;
    if (intro >= ALERT_THRESHOLDS.min_intro_score_for_open) continue;

    alerts.push(_alert({
      type:      ALERT_TYPES.NO_INTRO_PATH_HIGH_FIT_INVESTOR,
      severity:  'moderate',
      message:   `${inv.name} is a strong fit (${fit}) but no warm intro path exists. Consider who in the network knows this investor.`,
      entity_type:'investor',
      entity_id:  inv.id,
      context:   { fit_score: fit, intro_path_score: intro },
    }));
  }

  // ── 10. Stalled high-leverage relationship node ────────────────────────────
  for (const c of contacts) {
    const leverage = c.leverage_score ?? c.centrality_score ?? 0;
    if (leverage < 60) continue;
    const state = c.relationship_state ?? '';
    if (['stalled', 'cooling'].includes(state)) {
      alerts.push(_alert({
        type:      ALERT_TYPES.STALLED_RELATIONSHIP_HIGH_LEVERAGE,
        severity:  'high',
        message:   `${c.firstName ?? c.name ?? 'Contact'} is a high-leverage node (leverage: ${Math.round(leverage)}) and is ${state}.`,
        entity_type:'contact',
        entity_id:  c.id,
        context:   { leverage_score: leverage, relationship_state: state },
      }));
    }
  }

  // ── Sort: critical first, then high, then moderate, then info ─────────────
  const severityOrder = { critical: 4, high: 3, moderate: 2, info: 1 };
  alerts.sort((a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0));

  return {
    alerts,
    critical_count: alerts.filter((a) => a.severity === 'critical').length,
    high_count:     alerts.filter((a) => a.severity === 'high').length,
    total:          alerts.length,
  };
}

// ─── Command Center summary inputs ────────────────────────────────────────────

/**
 * Build the command center network summary.
 * Returns the most actionable items across all domains.
 */
export function buildCommandCenterSummary(ctx = {}) {
  const {
    boardState,
    contacts,
    boardCandidates,
    boardSeats,
    investors,
    credibilityIndex,
    introPathResults,
  } = ctx;

  const alertResult = generateNetworkAlerts({
    contacts, boardCandidates, boardSeats, investors,
    credibilityIndex, introPathResults,
  });

  // Weakest board seat
  const weakestSeat = boardState?.weakest_seat ?? null;

  // Best board candidate to act on now (highest fit, not passed/confirmed, stale)
  const activeCandidates = (boardCandidates ?? [])
    .filter((c) => !['passed', 'confirmed', 'archived'].includes(c.status ?? ''))
    .sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
  const bestCandidate = activeCandidates[0] ?? null;

  // High-value cooling relationship
  const coolingHighValue = (contacts ?? [])
    .filter((c) => {
      const influence = c.influence_score ?? c.influenceScore ?? 0;
      const state     = c.relationship_state ?? '';
      return influence >= 60 && ['cooling', 'stalled'].includes(state);
    })
    .sort((a, b) => (b.influence_score ?? b.influenceScore ?? 0) - (a.influence_score ?? a.influenceScore ?? 0))[0] ?? null;

  // Best available warm intro path
  const bestIntroPath = (introPathResults ?? [])
    .filter((p) => (p.best_path_score ?? 0) >= ALERT_THRESHOLDS.min_intro_score_for_open)
    .sort((a, b) => (b.best_path_score ?? 0) - (a.best_path_score ?? 0))[0] ?? null;

  // Top investor opportunity by fit + warmth
  const topInvestor = (investors ?? [])
    .filter((i) => !['passed'].includes(i.investorStage ?? i.stage ?? i.relationshipStage ?? ''))
    .sort((a, b) => {
      const aScore = (a.fit_score ?? 0) * 0.5 + (a.warmth_score ?? 0) * 0.5;
      const bScore = (b.fit_score ?? 0) * 0.5 + (b.warmth_score ?? 0) * 0.5;
      return bScore - aScore;
    })[0] ?? null;

  return {
    weakest_board_seat:                weakestSeat,
    best_board_candidate_to_act_on_now:bestCandidate,
    high_value_relationship_cooling:   coolingHighValue,
    best_available_warm_intro_path:    bestIntroPath,
    top_investor_opportunity:          topInvestor,
    credibility_index:                 credibilityIndex?.score ?? 0,
    credibility_label:                 credibilityIndex?.label ?? 'unknown',
    network_leverage_alerts:           alertResult.alerts.slice(0, 10),
    critical_alert_count:              alertResult.critical_count,
    high_alert_count:                  alertResult.high_count,
    total_alert_count:                 alertResult.total,
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _alert({ type, severity, message, entity_type, entity_id, contact_id, context }) {
  return {
    id:          `${type}_${entity_id ?? contact_id ?? Date.now()}`,
    type,
    severity:    ALERT_SEVERITIES.includes(severity) ? severity : 'moderate',
    message,
    entity_type: entity_type ?? 'contact',
    entity_id:   entity_id ?? contact_id,
    context:     context ?? {},
    generated_at: new Date().toISOString(),
  };
}

function _daysSince(isoDate) {
  if (!isoDate) return 999;
  return (Date.now() - new Date(isoDate).getTime()) / 86_400_000;
}

export default {
  ALERT_TYPES,
  ALERT_SEVERITIES,
  generateNetworkAlerts,
  buildCommandCenterSummary,
};
