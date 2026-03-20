/**
 * BoardSeatEngine
 *
 * Deterministic board seat health, risk, and readiness scoring.
 *
 * Rules:
 *  - All math is deterministic. AI may comment, never recompute.
 *  - industry_veteran seat receives extra urgency weighting system-wide.
 *  - Thresholds are centralized here — tune values here only.
 */

// ─── Seat definitions ──────────────────────────────────────────────────────────

export const REQUIRED_SEAT_TYPES = [
  'industry_veteran',
  'sba_banker',
  'm_and_a_attorney',
  'transaction_cpa',
  'operations_executor',
  'capital_connector',
];

export const SEAT_PRIORITY_RANK = {
  industry_veteran:    1,   // highest — transfers credibility to all other seats
  capital_connector:   2,
  sba_banker:          3,
  m_and_a_attorney:    4,
  transaction_cpa:     5,
  operations_executor: 6,
};

export const SEAT_HEALTH_STATES = ['empty', 'weak', 'developing', 'active', 'secured'];
export const SEAT_RISK_LEVELS   = ['low', 'moderate', 'high', 'critical'];

// ─── Seat thresholds ──────────────────────────────────────────────────────────

const SEAT_THRESHOLDS = {
  fit_threshold:              60,   // minimum fit_score to count as viable candidate
  strong_fit_threshold:       75,
  no_progress_critical_days:  7,    // seat w/ no progress beyond this → risk escalates
  developing_min_viable:      1,    // need ≥1 viable candidate to reach "developing"
  active_min_meetings:        1,    // need ≥1 meeting to reach "active"
  secured_min_commitments:    1,
  seat_readiness_floor:       0,
  seat_readiness_ceil:        100,
};

// ─── Readiness score weights ───────────────────────────────────────────────────

const READINESS_WEIGHTS = {
  seat_definition_completeness: 10,
  seat_coverage:                15,
  candidate_volume:             10,
  candidate_quality:            20,
  outreach_progress:            15,
  meeting_progress:             10,
  commitment_count:             10,
  industry_veteran_progress:    10,
};

// ─── Individual seat health ───────────────────────────────────────────────────

/**
 * Compute health state for a single seat based on its candidates.
 * @param {object}   seat        - seat record {id, seatType, ...}
 * @param {object[]} candidates  - all board candidates (filtered or full store)
 * @returns {string} health_state
 */
export function calcSeatHealthState(seat, candidates) {
  const seatCandidates = candidates.filter(
    (c) => c.seatId === seat.id || c.seat_type === seat.seatType
  );

  const committed = seatCandidates.filter((c) =>
    c.status === 'confirmed' || c.status === 'committed' || (c.commitment_probability ?? 0) >= 80
  );
  if (committed.length >= SEAT_THRESHOLDS.secured_min_commitments) return 'secured';

  const withMeetings = seatCandidates.filter((c) =>
    c.status === 'meeting_scheduled' ||
    c.status === 'interested' ||
    c.status === 'negotiating' ||
    (c.meeting_count ?? 0) >= 1 ||
    c.last_meeting_at
  );
  if (withMeetings.length >= SEAT_THRESHOLDS.active_min_meetings) return 'active';

  const viable = seatCandidates.filter(
    (c) => (c.fit_score ?? 0) >= SEAT_THRESHOLDS.fit_threshold
  );
  const hasOutreach = seatCandidates.some((c) =>
    c.status === 'outreach_sent' || c.status === 'researched' || c.last_outreach_at
  );
  if (viable.length >= SEAT_THRESHOLDS.developing_min_viable && hasOutreach) return 'developing';

  if (seatCandidates.length > 0) return 'weak';
  return 'empty';
}

/**
 * Compute risk level for a single seat.
 */
export function calcSeatRiskLevel(seat, candidates, daysSinceLastProgress) {
  const health = seat.health_state ?? calcSeatHealthState(seat, candidates);

  if (health === 'secured') return 'low';
  if (health === 'active')  return 'low';

  const noProgress = (daysSinceLastProgress ?? 0) >= SEAT_THRESHOLDS.no_progress_critical_days;
  const seatCandidates = candidates.filter(
    (c) => c.seatId === seat.id || c.seat_type === seat.seatType
  );
  const viable = seatCandidates.filter(
    (c) => (c.fit_score ?? 0) >= SEAT_THRESHOLDS.fit_threshold
  );
  const onlyLowFit = seatCandidates.length > 0 && viable.length === 0;
  const isVeteran  = seat.seatType === 'industry_veteran' || seat.seat_type === 'industry_veteran';

  if (health === 'empty') {
    if (isVeteran) return 'critical';
    return noProgress ? 'critical' : 'high';
  }
  if (health === 'weak') {
    if (isVeteran || noProgress || onlyLowFit) return 'high';
    return 'moderate';
  }
  if (health === 'developing') {
    if (noProgress) return 'moderate';
    return 'low';
  }

  return 'low';
}

/**
 * Compute days since last seat progress (outreach, meeting, status change).
 */
export function seatDaysSinceProgress(seat, candidates) {
  const seatCandidates = candidates.filter(
    (c) => c.seatId === seat.id || c.seat_type === seat.seatType
  );

  const timestamps = seatCandidates.flatMap((c) =>
    [c.last_outreach_at, c.last_reply_at, c.last_meeting_at, c.updatedAt, c.updated_at]
      .filter(Boolean)
      .map((t) => new Date(t).getTime())
  );
  if (timestamps.length === 0) return 999;
  const latestMs = Math.max(...timestamps);
  return (Date.now() - latestMs) / 86_400_000;
}

/**
 * Full seat analysis for a single seat.
 * Returns the seat enriched with health, risk, readiness_score, candidate counts.
 */
export function analyzeSeat(seat, candidates) {
  const seatCandidates = candidates.filter(
    (c) => c.seatId === seat.id || c.seat_type === seat.seatType
  );

  const viable   = seatCandidates.filter((c) => (c.fit_score ?? 0) >= SEAT_THRESHOLDS.fit_threshold);
  const strong   = seatCandidates.filter((c) => (c.fit_score ?? 0) >= SEAT_THRESHOLDS.strong_fit_threshold);
  const active   = seatCandidates.filter((c) =>
    ['outreach_sent', 'meeting_scheduled', 'interested', 'negotiating'].includes(c.status)
  );
  const committed = seatCandidates.filter((c) =>
    c.status === 'confirmed' || c.status === 'committed' || (c.commitment_probability ?? 0) >= 80
  );
  const meetingCount = seatCandidates.reduce((sum, c) => sum + (c.meeting_count ?? 0), 0);

  const daysSinceProgress = seatDaysSinceProgress(seat, candidates);
  const health_state      = calcSeatHealthState(seat, seatCandidates.length ? { ...seat, _candidates: seatCandidates } : seat, seatCandidates);
  const seat_risk_level   = calcSeatRiskLevel({ ...seat, health_state }, seatCandidates, daysSinceProgress);

  const seatType = seat.seatType ?? seat.seat_type ?? '';
  const priority = SEAT_PRIORITY_RANK[seatType] ?? 9;

  return {
    ...seat,
    seat_type:             seatType,
    priority_rank:         priority,
    health_state,
    seat_risk_level,
    candidate_count:       seatCandidates.length,
    viable_candidate_count:viable.length,
    strong_candidate_count:strong.length,
    active_candidate_count:active.length,
    meeting_count:         meetingCount,
    commitment_count:      committed.length,
    days_since_last_progress: daysSinceProgress,
    seat_fit_threshold:    SEAT_THRESHOLDS.fit_threshold,
    seat_readiness_score:  _seatReadinessScore(seatType, seatCandidates, committed, viable, active, meetingCount, daysSinceProgress),
    industry_veteran_boost: seatType === 'industry_veteran',
  };
}

function _seatReadinessScore(seatType, candidates, committed, viable, active, meetingCount, daysSinceProgress) {
  let score = 0;

  // candidate_volume: 0-10 proportional to candidates (cap at 5)
  score += Math.min(10, (candidates.length / 5) * 10);

  // candidate_quality: 0-20 based on viable count
  score += Math.min(20, (viable.length / 3) * 20);

  // outreach_progress: 0-15
  score += Math.min(15, (active.length / 3) * 15);

  // meeting_progress: 0-10
  score += Math.min(10, (meetingCount / 2) * 10);

  // commitment_count: 0-10
  score += Math.min(10, committed.length * 10);

  // no_stale_penalty: subtract up to 20 if no progress
  if (daysSinceProgress > 14) score = Math.max(0, score - 20);
  else if (daysSinceProgress > 7) score = Math.max(0, score - 10);

  // industry_veteran bonus weight: industry_veteran_progress slot adds up to 10
  const ivBonus = seatType === 'industry_veteran' ? Math.min(10, committed.length * 10) : 0;
  score += ivBonus;

  return Math.min(100, Math.round(score));
}

// ─── Board readiness score (firm-level) ───────────────────────────────────────

/**
 * Compute overall board readiness score across all required seats.
 * @param {object[]} seats      - board seat records
 * @param {object[]} candidates - all board candidates
 * @returns {{ score: number, label: string, components: object, weakest_seat: object|null, alerts: string[] }}
 */
export function calcBoardReadinessScore(seats, candidates) {
  // Ensure all required seat types are represented
  const coveredTypes   = new Set(seats.map((s) => s.seatType ?? s.seat_type));
  const definedCount   = REQUIRED_SEAT_TYPES.filter((t) => coveredTypes.has(t)).length;
  const totalRequired  = REQUIRED_SEAT_TYPES.length;
  const analyzedSeats  = seats.map((s) => analyzeSeat(s, candidates));

  // Component: seat_definition_completeness (0-10)
  const defComp = Math.round((definedCount / totalRequired) * READINESS_WEIGHTS.seat_definition_completeness);

  // Component: seat_coverage — how many seats are at least developing (0-15)
  const developingPlus = analyzedSeats.filter((s) =>
    ['developing', 'active', 'secured'].includes(s.health_state)
  ).length;
  const coverageComp = Math.round((developingPlus / totalRequired) * READINESS_WEIGHTS.seat_coverage);

  // Component: candidate_volume (0-10)
  const totalViable = analyzedSeats.reduce((sum, s) => sum + s.viable_candidate_count, 0);
  const volumeComp  = Math.round(Math.min(1, totalViable / (totalRequired * 2)) * READINESS_WEIGHTS.candidate_volume);

  // Component: candidate_quality (0-20) — average viable count per seat
  const avgViable  = totalViable / totalRequired;
  const qualityComp = Math.round(Math.min(1, avgViable / 2) * READINESS_WEIGHTS.candidate_quality);

  // Component: outreach_progress (0-15) — seats with active candidates
  const seatsWithActive = analyzedSeats.filter((s) => s.active_candidate_count > 0).length;
  const outreachComp = Math.round((seatsWithActive / totalRequired) * READINESS_WEIGHTS.outreach_progress);

  // Component: meeting_progress (0-10)
  const totalMeetings  = analyzedSeats.reduce((sum, s) => sum + s.meeting_count, 0);
  const meetingComp    = Math.round(Math.min(1, totalMeetings / (totalRequired * 2)) * READINESS_WEIGHTS.meeting_progress);

  // Component: commitment_count (0-10)
  const totalCommitted = analyzedSeats.reduce((sum, s) => sum + s.commitment_count, 0);
  const commitComp     = Math.round(Math.min(1, totalCommitted / totalRequired) * READINESS_WEIGHTS.commitment_count);

  // Component: industry_veteran_progress (0-10) — hard penalty if IV is empty/weak
  const ivSeat = analyzedSeats.find(
    (s) => s.seat_type === 'industry_veteran' || s.seatType === 'industry_veteran'
  );
  let ivComp = 0;
  if (ivSeat) {
    const ivMap = { empty: 0, weak: 2, developing: 5, active: 8, secured: 10 };
    ivComp = ivMap[ivSeat.health_state] ?? 0;
  }

  const totalScore = defComp + coverageComp + volumeComp + qualityComp +
    outreachComp + meetingComp + commitComp + ivComp;

  const components = {
    seat_definition_completeness: defComp,
    seat_coverage:                coverageComp,
    candidate_volume:             volumeComp,
    candidate_quality:            qualityComp,
    outreach_progress:            outreachComp,
    meeting_progress:             meetingComp,
    commitment_count:             commitComp,
    industry_veteran_progress:    ivComp,
  };

  const label = _boardReadinessLabel(totalScore);

  // Weakest seat by risk level + priority
  const riskOrder = { critical: 4, high: 3, moderate: 2, low: 1 };
  const weakestSeat = analyzedSeats.length
    ? [...analyzedSeats].sort((a, b) => {
        const rDiff = (riskOrder[b.seat_risk_level] ?? 0) - (riskOrder[a.seat_risk_level] ?? 0);
        if (rDiff !== 0) return rDiff;
        return (a.priority_rank ?? 9) - (b.priority_rank ?? 9);
      })[0]
    : null;

  const alerts = _boardAlerts(analyzedSeats, ivSeat);

  return {
    score: totalScore,
    label,
    components,
    analyzed_seats: analyzedSeats,
    weakest_seat:   weakestSeat,
    alerts,
  };
}

function _boardReadinessLabel(score) {
  if (score >= 90) return 'elite';
  if (score >= 75) return 'strong';
  if (score >= 60) return 'solid';
  if (score >= 40) return 'developing';
  return 'weak';
}

function _boardAlerts(analyzedSeats, ivSeat) {
  const alerts = [];
  for (const s of analyzedSeats) {
    if (s.health_state === 'empty') {
      alerts.push({ type: 'seat_empty', seat_type: s.seat_type, severity: s.industry_veteran_boost ? 'critical' : 'high' });
    } else if (s.health_state === 'weak') {
      alerts.push({ type: 'seat_weak', seat_type: s.seat_type, severity: 'moderate' });
    }
    if (s.days_since_last_progress > 7 && !['secured'].includes(s.health_state)) {
      alerts.push({ type: 'seat_no_progress', seat_type: s.seat_type, days: Math.round(s.days_since_last_progress), severity: 'high' });
    }
    if (s.viable_candidate_count === 1 && s.commitment_count === 0) {
      alerts.push({ type: 'seat_single_viable_candidate', seat_type: s.seat_type, severity: 'moderate' });
    }
  }
  if (ivSeat && ['empty', 'weak'].includes(ivSeat.health_state)) {
    alerts.push({ type: 'industry_veteran_weak', severity: 'critical', message: 'Industry veteran seat is weak — credibility transfer to bankers and investors is limited.' });
  }
  return alerts;
}

// ─── Candidate ranking within a seat ─────────────────────────────────────────

/**
 * Rank candidates for a given seat type, applying all spec tie-break rules.
 */
export function rankCandidatesForSeat(seatType, candidates) {
  const seatCandidates = candidates.filter(
    (c) => c.seatType === seatType || c.seat_type === seatType
  );

  const riskOrder = { critical: 4, high: 3, moderate: 2, low: 1 };
  const seatPriority = SEAT_PRIORITY_RANK[seatType] ?? 9;

  return seatCandidates
    .map((c) => {
      const stalePenalty = c.days_since_last_progress > 14
        ? 15
        : c.days_since_last_progress > 7 ? 7 : 0;

      const rankScore =
        (c.fit_score              ?? 0) * 0.30 +
        (10 - seatPriority)            * 2.0 +
        (c.warm_intro_score        ?? 0) * 0.15 +
        (c.response_score          ?? 0) * 0.12 +
        (c.commitment_probability  ?? 0) * 0.18 +
        (c.network_score           ?? 0) * 0.10 +
        (c.credibility_score       ?? 0) * 0.10 -
        stalePenalty;

      return { ...c, _rank_score: Math.max(0, rankScore) };
    })
    .sort((a, b) => b._rank_score - a._rank_score);
}

export const SEAT_THRESHOLDS_CONFIG = SEAT_THRESHOLDS;

export default {
  REQUIRED_SEAT_TYPES,
  SEAT_PRIORITY_RANK,
  SEAT_HEALTH_STATES,
  SEAT_RISK_LEVELS,
  calcSeatHealthState,
  calcSeatRiskLevel,
  seatDaysSinceProgress,
  analyzeSeat,
  calcBoardReadinessScore,
  rankCandidatesForSeat,
};
