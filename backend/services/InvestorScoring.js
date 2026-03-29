/**
 * InvestorScoring
 *
 * Deterministic investor fit, warmth, readiness gap, and priority ranking.
 *
 * Rules:
 *  - All math is deterministic. AI may produce commentary, never recompute scores.
 *  - Fit, warmth, and readiness gap models are centralized here.
 *  - Intro path scores come from RelationshipGraph.
 */

// ─── Investor stages ──────────────────────────────────────────────────────────

export const INVESTOR_STAGES = [
  'identified',
  'qualified',
  'intro_needed',
  'contacted',
  'responded',
  'meeting_set',
  'memo_sent',
  'diligence',
  'soft_circle',
  'committed',
  'passed',
];

// ─── Investor warmth states ───────────────────────────────────────────────────

export const INVESTOR_WARMTH_STATES = [
  'cold',
  'warm',
  'warm_intro_available',
  'engaged',
  'active',
  'soft',
];

// ─── Fit score formula ────────────────────────────────────────────────────────
//
// Weights (sum 100):
//   check_size_fit           15
//   industry_fit             15
//   stage_fit                10
//   geo_fit                  10
//   warm_intro_strength      15
//   investor_thesis_relevance 10
//   responsiveness           10
//   historical_alignment     10
//   timing_fit                5

const FIT_WEIGHTS = {
  check_size_fit:           15,
  industry_fit:             15,
  stage_fit:                10,
  geo_fit:                  10,
  warm_intro_strength:      15,
  investor_thesis_relevance:10,
  responsiveness:           10,
  historical_alignment:     10,
  timing_fit:                5,
};

const FIT_LABELS = [
  { min: 85, label: 'top_tier' },
  { min: 70, label: 'strong' },
  { min: 55, label: 'viable' },
  { min: 40, label: 'possible' },
  { min:  0, label: 'weak' },
];

export function investorFitLabel(score) {
  for (const { min, label } of FIT_LABELS) {
    if (score >= min) return label;
  }
  return 'weak';
}

/**
 * Compute investor fit score.
 *
 * @param {object} investor        - investor record
 * @param {object} firmContext     - { dealSize, industry, stage, geo, thesis }
 * @param {number} introPathScore  - 0-100 intro path score from RelationshipGraph
 * @returns {{ score: number, label: string, components: object }}
 */
export function calcInvestorFitScore(investor, firmContext = {}, introPathScore = 0) {
  const inv = investor;
  const ctx = firmContext;

  const check_size_fit           = _checkSizeFit(inv, ctx.dealSize);
  const industry_fit             = _industryFit(inv, ctx.industry);
  const stage_fit                = _stageFit(inv, ctx.stage);
  const geo_fit                  = _geoFit(inv, ctx.geo);
  const warm_intro_strength      = _clamp(introPathScore);
  const investor_thesis_relevance = _thesisRelevance(inv, ctx.thesis);
  const responsiveness           = _responsiveness(inv);
  const historical_alignment     = _historicalAlignment(inv);
  const timing_fit               = _timingFit(inv);

  const components = {
    check_size_fit, industry_fit, stage_fit, geo_fit,
    warm_intro_strength, investor_thesis_relevance, responsiveness,
    historical_alignment, timing_fit,
  };

  const score = Math.round(
    Object.entries(FIT_WEIGHTS).reduce((sum, [key, w]) =>
      sum + (components[key] ?? 0) * (w / 100), 0
    )
  );

  return { score: _clamp(score), label: investorFitLabel(score), components };
}

// ─── Warmth score ─────────────────────────────────────────────────────────────

/**
 * Compute investor warmth state.
 * @param {object} investor
 * @param {number} introPathScore - best available intro path score
 * @param {object[]} interactions - interaction history
 * @returns {{ warmth_state: string, warmth_score: number }}
 */
export function calcInvestorWarmth(investor, introPathScore = 0, interactions = []) {
  const inv = investor;
  const stage = inv.investorStage ?? inv.stage ?? inv.relationshipStage ?? 'identified';

  if (['soft_circle', 'committed'].includes(stage)) {
    return { warmth_state: 'soft', warmth_score: 95 };
  }
  if (['diligence', 'memo_sent'].includes(stage)) {
    return { warmth_state: 'active', warmth_score: 85 };
  }
  if (['responded', 'meeting_set'].includes(stage)) {
    return { warmth_state: 'engaged', warmth_score: 75 };
  }

  const hasIntroPath = introPathScore >= 50;
  if (hasIntroPath && stage === 'intro_needed') {
    return { warmth_state: 'warm_intro_available', warmth_score: 60 };
  }
  if (stage === 'contacted' || inv.lastInteractionAt) {
    return { warmth_state: 'warm', warmth_score: 45 };
  }
  if (introPathScore >= 40) {
    return { warmth_state: 'warm_intro_available', warmth_score: 40 };
  }

  return { warmth_state: 'cold', warmth_score: 10 };
}

// ─── Readiness gap model ──────────────────────────────────────────────────────

/**
 * Identify what is missing before serious investor outreach.
 * @param {object} firmContext - { hasThesis, hasMemo, hasTraction, hasAsk, hasBoard, hasIntro, credibilityScore }
 * @returns {{ gaps: string[], gap_count: number, ready: boolean }}
 */
export function calcInvestorReadinessGaps(firmContext = {}) {
  const ctx = firmContext;
  const gaps = [];

  if (!ctx.hasThesis)       gaps.push('thesis_clarity_gap');
  if (!ctx.hasDeal)         gaps.push('deal_readiness_gap');
  if (!ctx.hasMemo)         gaps.push('memo_gap');
  if (!ctx.hasTraction)     gaps.push('traction_gap');
  if (!ctx.hasAsk)          gaps.push('ask_clarity_gap');
  if (!ctx.hasIntro)        gaps.push('intro_gap');
  if ((ctx.credibilityScore ?? 0) < 50) gaps.push('credibility_gap');

  return {
    gaps,
    gap_count: gaps.length,
    ready:     gaps.length === 0,
    critical_gaps: gaps.filter((g) => ['thesis_clarity_gap', 'deal_readiness_gap', 'credibility_gap'].includes(g)),
  };
}

// ─── Soft circle probability ─────────────────────────────────────────────────

/**
 * Directional soft circle probability (treat as signal, not forecast).
 * @param {object}   investor
 * @param {object[]} interactions
 * @returns {{ probability: number, label: string }}
 */
export function calcSoftCircleProbability(investor, interactions = []) {
  const inv   = investor;
  const stage = inv.investorStage ?? inv.stage ?? inv.relationshipStage ?? 'identified';

  if (stage === 'committed')  return { probability: 95, label: 'committed' };
  if (stage === 'soft_circle') return { probability: 75, label: 'likely' };
  if (stage === 'diligence')  return { probability: 55, label: 'possible' };

  const meetingCount     = interactions.filter((i) => i.type === 'meeting_completed' || i.type === 'meeting').length;
  const positiveSignals  = interactions.filter((i) => i.sentiment === 'positive' || i.type === 'reply_received').length;
  const hasExplicit      = inv.notes?.toLowerCase().includes('interest') ||
                           inv.notes?.toLowerCase().includes('follow up') ? 1 : 0;

  const raw = Math.min(1, meetingCount / 3) * 40 +
              Math.min(1, positiveSignals / 5) * 30 +
              hasExplicit * 20 +
              (stage === 'memo_sent' ? 10 : 0);

  const prob = _clamp(raw);

  return {
    probability: prob,
    label:       prob >= 60 ? 'likely' : prob >= 35 ? 'possible' : 'unlikely',
  };
}

// ─── Priority ranking ─────────────────────────────────────────────────────────

/**
 * Rank a list of investors by priority.
 *
 * Sort: fit_score → warmth_score → intro_strength → timing_fit → check_size_relevance → responsiveness
 *
 * For high-fit but cold investors: include intro path availability info.
 */
export function rankInvestors(investors, firmContext = {}) {
  return investors
    .filter((inv) => inv.stage !== 'passed' && inv.investorStage !== 'passed')
    .map((inv) => {
      const introScore = inv.intro_path_score ?? 0;
      const fit    = inv.fit_score     ?? calcInvestorFitScore(inv, firmContext, introScore).score;
      const warmth = inv.warmth_score  ?? calcInvestorWarmth(inv, introScore).warmth_score;

      const rankScore =
        fit    * 0.35 +
        warmth * 0.25 +
        introScore * 0.20 +
        (inv.timing_score         ?? 50) * 0.10 +
        (inv.responsiveness_score ?? 50) * 0.10;

      // For high-fit cold investors — flag for intro gap
      const isHighFitCold = fit >= 70 && warmth < 40;

      return {
        ...inv,
        _rank_score:     Math.round(rankScore),
        fit_score:       fit,
        warmth_score:    warmth,
        is_high_fit_cold: isHighFitCold,
        has_intro_path:  introScore >= 40,
        intro_path_score: introScore,
      };
    })
    .sort((a, b) => b._rank_score - a._rank_score);
}

/**
 * Get top investors by fit AND warmth — the ones to act on now.
 */
export function getHighFitInvestors(investors, firmContext = {}, { limit = 10, minFit = 60 } = {}) {
  return rankInvestors(investors, firmContext)
    .filter((inv) => inv.fit_score >= minFit)
    .slice(0, limit);
}

// ─── Investor funnel summary ──────────────────────────────────────────────────

/**
 * Return stage-by-stage funnel counts.
 */
export function buildInvestorFunnel(investors) {
  const stageCounts = {};
  for (const stage of INVESTOR_STAGES) {
    stageCounts[stage] = 0;
  }

  for (const inv of investors) {
    const stage = inv.investorStage ?? inv.stage ?? inv.relationshipStage;
    if (stage && stageCounts[stage] !== undefined) {
      stageCounts[stage]++;
    }
  }

  return {
    stages: INVESTOR_STAGES.map((s) => ({ stage: s, count: stageCounts[s] })),
    total:  investors.length,
    active: investors.filter((i) => !['identified', 'passed'].includes(i.investorStage ?? i.stage ?? i.relationshipStage)).length,
  };
}

// ─── Full investor context record ─────────────────────────────────────────────

/**
 * Build a fully scored investor record.
 */
export function scoreInvestorFull(investor, firmContext = {}, interactions = [], introPathScore = 0) {
  const fit     = calcInvestorFitScore(investor, firmContext, introPathScore);
  const warmth  = calcInvestorWarmth(investor, introPathScore, interactions);
  const prob    = calcSoftCircleProbability(investor, interactions);
  const stage   = investor.investorStage ?? investor.stage ?? investor.relationshipStage ?? 'identified';

  const daysAgo = investor.lastInteractionAt
    ? (Date.now() - new Date(investor.lastInteractionAt).getTime()) / 86_400_000
    : null;

  return {
    ...investor,
    investor_stage:            stage,
    fit_score:                 fit.score,
    fit_label:                 fit.label,
    fit_components:            fit.components,
    warmth_state:              warmth.warmth_state,
    warmth_score:              warmth.warmth_score,
    intro_path_score:          introPathScore,
    has_intro_path:            introPathScore >= 40,
    soft_circle_probability:   prob.probability,
    soft_circle_label:         prob.label,
    days_since_last_touch:     daysAgo ? Math.round(daysAgo) : null,
    last_meaningful_touch_at:  investor.lastInteractionAt ?? null,
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _clamp(v) { return Math.max(0, Math.min(100, Math.round(v ?? 0))); }

function _checkSizeFit(inv, dealSize) {
  if (!dealSize) return 50;
  const min = inv.checkSizeMin ?? 0;
  const max = inv.checkSizeMax ?? Infinity;
  if (dealSize >= min && dealSize <= max) return 100;
  if (dealSize >= min * 0.7 && dealSize <= max * 1.3) return 65;
  return 20;
}

function _industryFit(inv, industry) {
  if (!industry) return 50;
  const preferred = (inv.industriesPreferred ?? []).map((s) => s.toLowerCase());
  const q = industry.toLowerCase();
  if (preferred.some((p) => p.includes(q) || q.includes(p))) return 100;
  if (preferred.length === 0) return 50; // generalist
  return 20;
}

function _stageFit(inv, stage) {
  const pref = (inv.dealStagePreference ?? '').toLowerCase();
  if (!pref) return 50;
  if (!stage) return 50;
  return pref.includes(stage.toLowerCase()) ? 100 : 35;
}

function _geoFit(inv, geo) {
  if (!geo || !inv.location) return 50;
  return inv.location.toLowerCase().includes(geo.toLowerCase()) ? 100 : 35;
}

function _thesisRelevance(inv, thesis) {
  if (!thesis) return 50;
  const notes = (inv.notes ?? '').toLowerCase() + (inv.priorDeals ?? '').toLowerCase();
  const kw    = thesis.toLowerCase().split(' ').filter((w) => w.length > 4);
  const hits  = kw.filter((w) => notes.includes(w)).length;
  return _clamp(hits > 0 ? (hits / kw.length) * 100 : 30);
}

function _responsiveness(inv) {
  const stage = inv.investorStage ?? inv.stage ?? inv.relationshipStage ?? 'identified';
  const map = {
    committed: 100, soft_circle: 90, diligence: 85, meeting_set: 80,
    responded: 70, memo_sent: 65, contacted: 40, intro_needed: 30,
    qualified: 20, identified: 10,
  };
  return map[stage] ?? 20;
}

function _historicalAlignment(inv) {
  return _clamp((inv.historical_alignment_score ?? 0) || 50);
}

function _timingFit(inv) {
  const stage = inv.investorStage ?? inv.stage ?? inv.relationshipStage ?? 'identified';
  if (['soft_circle', 'diligence', 'meeting_set'].includes(stage)) return 80;
  if (stage === 'responded') return 65;
  return 40;
}

export default {
  INVESTOR_STAGES,
  INVESTOR_WARMTH_STATES,
  FIT_WEIGHTS,
  investorFitLabel,
  calcInvestorFitScore,
  calcInvestorWarmth,
  calcInvestorReadinessGaps,
  calcSoftCircleProbability,
  rankInvestors,
  getHighFitInvestors,
  buildInvestorFunnel,
  scoreInvestorFull,
};
