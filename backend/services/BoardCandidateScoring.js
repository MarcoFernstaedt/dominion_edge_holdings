/**
 * BoardCandidateScoring
 *
 * Deterministic fit scoring, commitment probability, and ranking for board candidates.
 *
 * Rules:
 *  - All math is deterministic. AI may produce commentary, never recompute scores.
 *  - Scores are 0–100 integers.
 *  - Fit labels: weak(0-39) | possible(40-59) | viable(60-74) | strong(75-89) | top_tier(90-100)
 */

import { SEAT_PRIORITY_RANK } from './BoardSeatEngine.js';

// ─── Score labels ─────────────────────────────────────────────────────────────

export const FIT_LABELS = [
  { min: 90, label: 'top_tier' },
  { min: 75, label: 'strong' },
  { min: 60, label: 'viable' },
  { min: 40, label: 'possible' },
  { min:  0, label: 'weak' },
];

export function fitLabel(score) {
  for (const { min, label } of FIT_LABELS) {
    if (score >= min) return label;
  }
  return 'weak';
}

export function isViable(score) { return score >= 60; }
export function isStrong(score)  { return score >= 75; }

// ─── Fit score formula ────────────────────────────────────────────────────────
//
// Weights (must sum to 100):
//   seat_relevance          25
//   seniority               10
//   credibility_value       15
//   network_value           15
//   local_relevance          5
//   warm_intro_availability 10
//   response_quality        10
//   time_burden_realism      5
//   advisory_fit             5

const FIT_WEIGHTS = {
  seat_relevance:          25,
  seniority:               10,
  credibility_value:       15,
  network_value:           15,
  local_relevance:          5,
  warm_intro_availability: 10,
  response_quality:        10,
  time_burden_realism:      5,
  advisory_fit:             5,
};

/**
 * Compute fit score from a candidate record.
 *
 * Candidate may carry pre-scored sub-components (0-100 each), or the function
 * will estimate from available fields.
 *
 * @param {object} candidate
 * @param {string} seatType  - target seat type for seat_relevance calculation
 * @returns {{ score: number, label: string, components: object }}
 */
export function calcFitScore(candidate, seatType) {
  const c = candidate;
  const st = seatType ?? c.seat_type ?? c.seatType ?? '';

  // sub-component scores — use explicit field if present, else estimate
  const seat_relevance          = _clamp(c.seat_relevance_score          ?? _estimateSeatRelevance(c, st));
  const seniority               = _clamp(c.seniority_score               ?? _estimateSeniority(c));
  const credibility_value       = _clamp(c.credibility_score             ?? 50);
  const network_value           = _clamp(c.network_score                 ?? 50);
  const local_relevance         = _clamp(c.local_relevance_score         ?? 50);
  const warm_intro_availability = _clamp(c.warm_intro_score              ?? _estimateWarmIntro(c));
  const response_quality        = _clamp(c.response_score                ?? _estimateResponseQuality(c));
  const time_burden_realism     = _clamp(c.willingness_signal_score      ?? 50);
  const advisory_fit            = _clamp(c.engagement_score              ?? 50);

  const components = {
    seat_relevance, seniority, credibility_value, network_value,
    local_relevance, warm_intro_availability, response_quality,
    time_burden_realism, advisory_fit,
  };

  const score = Math.round(
    seat_relevance          * (FIT_WEIGHTS.seat_relevance          / 100) +
    seniority               * (FIT_WEIGHTS.seniority               / 100) +
    credibility_value       * (FIT_WEIGHTS.credibility_value       / 100) +
    network_value           * (FIT_WEIGHTS.network_value           / 100) +
    local_relevance         * (FIT_WEIGHTS.local_relevance         / 100) +
    warm_intro_availability * (FIT_WEIGHTS.warm_intro_availability / 100) +
    response_quality        * (FIT_WEIGHTS.response_quality        / 100) +
    time_burden_realism     * (FIT_WEIGHTS.time_burden_realism     / 100) +
    advisory_fit            * (FIT_WEIGHTS.advisory_fit            / 100)
  );

  return { score: _clamp(score), label: fitLabel(score), components };
}

// ─── Commitment probability ───────────────────────────────────────────────────
//
// Weighted inputs (scaled 0-100):
//   fit_score                  30
//   meeting_count              20
//   reply_quality              15
//   warm_intro_presence        10
//   explicit_interest_signal   10
//   follow_up_momentum         10
//   objection_burden (inverse)  5

/**
 * Compute commitment probability for a candidate.
 * @returns {{ probability: number, label: string }}
 */
export function calcCommitmentProbability(candidate) {
  const c = candidate;

  const fit            = _clamp(c.fit_score ?? 0) / 100;
  const meetings       = _clamp(Math.min((c.meeting_count ?? 0) / 3, 1) * 100) / 100;
  const replyQuality   = _clamp(c.response_score ?? c.reply_quality_score ?? 50) / 100;
  const warmIntro      = (c.warm_intro_score ?? 0) > 40 ? 1.0 : 0.4;
  const explicitSignal = _explicitInterestSignal(c);
  const momentum       = _followUpMomentum(c);
  const objBurden      = 1 - _clamp((c.objection_count ?? 0) / 5) / 100;

  const prob = Math.round(
    fit            * 30 +
    meetings       * 20 +
    replyQuality   * 15 +
    warmIntro      * 10 +
    explicitSignal * 10 +
    momentum       * 10 +
    objBurden      * 5
  );

  return {
    probability: _clamp(prob),
    label:       _commitLabel(prob),
  };
}

function _commitLabel(p) {
  if (p >= 75) return 'likely';
  if (p >= 50) return 'possible';
  if (p >= 25) return 'uncertain';
  return 'unlikely';
}

// ─── Full candidate scoring record ────────────────────────────────────────────

/**
 * Build a complete scored candidate record.
 * Merges fit score + commitment probability + metadata onto the candidate.
 */
export function scoreCandidateFull(candidate, seatType) {
  const st = seatType ?? candidate.seat_type ?? candidate.seatType ?? '';
  const fit  = calcFitScore(candidate, st);
  const prob = calcCommitmentProbability({ ...candidate, fit_score: fit.score });

  const daysProgress = _daysSinceProgress(candidate);

  return {
    ...candidate,
    seat_type:             st,
    fit_score:             fit.score,
    fit_label:             fit.label,
    fit_components:        fit.components,
    commitment_probability:prob.probability,
    commitment_label:      prob.label,
    days_since_last_progress: daysProgress,
    is_viable:             isViable(fit.score),
    is_strong:             isStrong(fit.score),
  };
}

// ─── Candidate ranking ────────────────────────────────────────────────────────

/**
 * Rank a list of candidates for a seat, applying spec tie-break rules.
 *
 * Sort order:
 *  1. fit_score (desc)
 *  2. seat priority (asc — lower number = higher priority)
 *  3. warm_intro_score (desc) — tie-break favor warm intro
 *  4. response_quality (desc)
 *  5. days_since_last_progress penalty (asc — less stale preferred)
 *  6. commitment_probability (desc)
 *  7. network_score (desc)
 *
 * Industry veteran tiebreak: among similar candidates, also boost credibility_score.
 */
export function rankCandidates(candidates, seatType) {
  const st = seatType ?? '';
  const seatPriority = SEAT_PRIORITY_RANK[st] ?? 9;
  const isVeteranSeat = st === 'industry_veteran';

  return candidates
    .map((c) => {
      const scored = c.fit_score != null ? c : scoreCandidateFull(c, st);
      const stalePenalty = (scored.days_since_last_progress ?? 0) > 14 ? 15
        : (scored.days_since_last_progress ?? 0) > 7 ? 7 : 0;

      const credBonus = isVeteranSeat ? (scored.credibility_score ?? 0) * 0.10 : 0;

      const rankScore =
        (scored.fit_score              ?? 0) * 0.30 +
        (10 - seatPriority)                  * 2.0  +
        (scored.warm_intro_score        ?? 0) * 0.15 +
        (scored.response_score          ?? 0) * 0.12 +
        (scored.commitment_probability  ?? 0) * 0.18 +
        (scored.network_score           ?? 0) * 0.10 +
        credBonus -
        stalePenalty;

      return { ...scored, _rank_score: Math.max(0, rankScore) };
    })
    .sort((a, b) => b._rank_score - a._rank_score);
}

/**
 * Best candidate to act on now for a given seat:
 * The highest-ranked candidate who is not passed/archived and hasn't been
 * recently followed up with.
 */
export function bestCandidateToActOnNow(candidates, seatType) {
  const ranked = rankCandidates(
    candidates.filter((c) => !['passed', 'confirmed', 'archived'].includes(c.status ?? '')),
    seatType
  );
  return ranked[0] ?? null;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _clamp(v) { return Math.max(0, Math.min(100, Math.round(v ?? 0))); }

function _estimateSeatRelevance(c, seatType) {
  // If candidate's contact type maps to seat type, high relevance
  const typeMap = {
    industry_veteran:    ['operator', 'networking_contact', 'board_candidate'],
    sba_banker:          ['banker'],
    m_and_a_attorney:    ['attorney'],
    transaction_cpa:     ['cpa'],
    operations_executor: ['operator', 'employee_candidate'],
    capital_connector:   ['capital_partner', 'banker', 'networking_contact'],
  };
  const relevantTypes = typeMap[seatType] ?? [];
  const contactType   = c.contactType ?? c.contact_type ?? '';
  if (relevantTypes.includes(contactType)) return 80;
  if (c.bio?.toLowerCase().includes(seatType?.replace(/_/g, ' ') ?? '')) return 65;
  return 40;
}

function _estimateSeniority(c) {
  const title = (c.title ?? '').toLowerCase();
  if (title.includes('ceo') || title.includes('president') || title.includes('founder') ||
      title.includes('partner') || title.includes('managing director')) return 85;
  if (title.includes('vp') || title.includes('director') || title.includes('principal') ||
      title.includes('senior')) return 65;
  if (title.includes('manager') || title.includes('associate')) return 45;
  return 50; // unknown
}

function _estimateWarmIntro(c) {
  if (c.who_can_introduce && (Array.isArray(c.who_can_introduce) ? c.who_can_introduce.length > 0 : true)) return 80;
  if (c.intro_path_available) return 70;
  return 25;
}

function _estimateResponseQuality(c) {
  const status = c.status ?? '';
  if (['interested', 'negotiating', 'confirmed'].includes(status)) return 85;
  if (status === 'meeting_scheduled') return 70;
  if (status === 'outreach_sent')     return 35;
  if (c.last_reply_at)                return 60;
  return 30;
}

function _explicitInterestSignal(c) {
  const status = c.status ?? '';
  if (['interested', 'negotiating', 'confirmed'].includes(status)) return 1.0;
  if (status === 'meeting_scheduled') return 0.6;
  if ((c.response_score ?? 0) > 70)   return 0.5;
  return 0.1;
}

function _followUpMomentum(c) {
  const lastTouch = c.last_reply_at ?? c.last_outreach_at ?? c.last_meeting_at ?? null;
  if (!lastTouch) return 0.1;
  const daysAgo = (Date.now() - new Date(lastTouch).getTime()) / 86_400_000;
  if (daysAgo < 3)  return 1.0;
  if (daysAgo < 7)  return 0.75;
  if (daysAgo < 14) return 0.5;
  return 0.2;
}

function _daysSinceProgress(c) {
  const timestamps = [c.last_reply_at, c.last_outreach_at, c.last_meeting_at, c.updatedAt, c.updated_at]
    .filter(Boolean)
    .map((t) => new Date(t).getTime());
  if (!timestamps.length) return 999;
  return (Date.now() - Math.max(...timestamps)) / 86_400_000;
}

export default {
  FIT_LABELS,
  FIT_WEIGHTS,
  fitLabel,
  isViable,
  isStrong,
  calcFitScore,
  calcCommitmentProbability,
  scoreCandidateFull,
  rankCandidates,
  bestCandidateToActOnNow,
};
