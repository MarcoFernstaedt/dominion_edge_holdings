/**
 * CredibilityIndex
 *
 * Deterministic firm-level credibility scoring.
 *
 * Used by:
 *  - Board outreach prioritization
 *  - Investor readiness assessment
 *  - Warm intro ask confidence
 *  - Command center context
 *  - Next-action weighting
 *
 * All math is deterministic. AI may annotate, never recompute.
 */

// ─── Component weights (sum = 100) ────────────────────────────────────────────

const CREDIBILITY_WEIGHTS = {
  industry_veteran_progress:  15,  // most trusted signal to banks + investors
  board_readiness:            15,
  advisor_quality:            10,
  asset_completeness:         10,  // website, deck, memo
  thesis_clarity:             10,
  deal_pipeline_seriousness:  15,
  document_readiness:          5,
  meeting_traction:           10,
  capital_connector_progress: 10,
};

// ─── Score labels ─────────────────────────────────────────────────────────────

const CREDIBILITY_LABELS = [
  { min: 85, label: 'elite' },
  { min: 70, label: 'credible' },
  { min: 50, label: 'developing' },
  { min: 30, label: 'early_stage' },
  { min:  0, label: 'limited' },
];

export function credibilityLabel(score) {
  for (const { min, label } of CREDIBILITY_LABELS) {
    if (score >= min) return label;
  }
  return 'limited';
}

// ─── Main credibility index calculator ────────────────────────────────────────

/**
 * Compute the firm's credibility index from available data.
 *
 * @param {object} ctx
 * @param {object}   ctx.boardState        - result from BoardSeatEngine.calcBoardReadinessScore
 * @param {object}   ctx.settings          - firm settings {website, pitchDeck, ...}
 * @param {object[]} ctx.deals             - active deal pipeline
 * @param {object[]} ctx.meetings          - all meetings
 * @param {object[]} ctx.documents         - all documents
 * @param {object[]} ctx.investors         - investor list
 * @param {object[]} ctx.contacts          - contact list
 * @param {string}   ctx.thesisText        - firm thesis text (for clarity check)
 *
 * @returns {{ score: number, label: string, components: object, downstream: object, gaps: string[] }}
 */
export function calcCredibilityIndex(ctx = {}) {
  const {
    boardState,
    settings    = {},
    deals       = [],
    meetings    = [],
    documents   = [],
    investors   = [],
    contacts    = [],
    thesisText  = '',
  } = ctx;

  // ── industry_veteran_progress (0-15 → normalized to 0-100 for weighting) ──
  const ivSeat = (boardState?.analyzed_seats ?? []).find(
    (s) => s.seat_type === 'industry_veteran' || s.seatType === 'industry_veteran'
  );
  const ivRaw = ivSeat
    ? { empty: 0, weak: 20, developing: 50, active: 80, secured: 100 }[ivSeat.health_state] ?? 0
    : 0;

  // ── board_readiness ────────────────────────────────────────────────────────
  const boardRaw = boardState?.score ?? 0;

  // ── advisor_quality ───────────────────────────────────────────────────────
  // Based on high-influence contacts (influenceScore ≥ 7)
  const highInfluenceAdvisors = contacts.filter(
    (c) => (c.influenceScore ?? c.influence_score ?? 0) >= 7 &&
           ['board_candidate', 'operator', 'capital_partner', 'banker'].includes(
             c.contactType ?? c.contact_type ?? ''
           )
  );
  const advisorRaw = _clamp(Math.min(1, highInfluenceAdvisors.length / 3) * 100);

  // ── asset_completeness ────────────────────────────────────────────────────
  let assetScore = 0;
  if (settings.website || settings.fromEmail) assetScore += 30;
  const hasPitch  = documents.some((d) => d.documentType === 'deal_memo' || d.documentType === 'board_update');
  const hasDeck   = investors.some((i) => i.memoSentAt || i.memo_sent_at);
  if (hasPitch) assetScore += 35;
  if (hasDeck)  assetScore += 35;
  const assetRaw = _clamp(assetScore);

  // ── thesis_clarity ────────────────────────────────────────────────────────
  const thesisRaw = _thesisClarity(thesisText, settings);

  // ── deal_pipeline_seriousness ─────────────────────────────────────────────
  const activeDeals = deals.filter((d) =>
    !['lost', 'closed', 'identified'].includes(d.stage ?? d.status ?? '')
  );
  const advancedDeals = deals.filter((d) =>
    ['loi_drafting', 'loi_sent', 'exclusivity', 'diligence', 'financing', 'closing'].includes(d.stage ?? '')
  );
  const pipelineRaw = _clamp(
    Math.min(1, activeDeals.length / 5) * 50 +
    Math.min(1, advancedDeals.length  ) * 50
  );

  // ── document_readiness ────────────────────────────────────────────────────
  const keyDocTypes = ['loi', 'deal_memo', 'diligence_checklist', 'board_invite'];
  const docCount    = documents.filter((d) => keyDocTypes.includes(d.documentType)).length;
  const docRaw      = _clamp(Math.min(1, docCount / 4) * 100);

  // ── meeting_traction ──────────────────────────────────────────────────────
  const significantMeetings = meetings.filter((m) =>
    ['board_intro', 'banker_intro', 'capital_intro', 'diligence_review'].includes(m.meetingType ?? m.meeting_type ?? '')
  );
  const recentMeetings = meetings.filter((m) => {
    const t = m.scheduledAt ?? m.scheduled_at ?? m.createdAt;
    return t && (Date.now() - new Date(t).getTime()) / 86_400_000 < 90;
  });
  const meetingRaw = _clamp(
    Math.min(1, significantMeetings.length / 5) * 60 +
    Math.min(1, recentMeetings.length / 3) * 40
  );

  // ── capital_connector_progress ────────────────────────────────────────────
  const ccSeat = (boardState?.analyzed_seats ?? []).find(
    (s) => s.seat_type === 'capital_connector' || s.seatType === 'capital_connector'
  );
  const ccRaw = ccSeat
    ? { empty: 0, weak: 20, developing: 50, active: 80, secured: 100 }[ccSeat.health_state] ?? 0
    : _estimateCapConnectorFromContacts(contacts);

  // ── Weighted score ─────────────────────────────────────────────────────────
  const components = {
    industry_veteran_progress:  ivRaw,
    board_readiness:            boardRaw,
    advisor_quality:            advisorRaw,
    asset_completeness:         assetRaw,
    thesis_clarity:             thesisRaw,
    deal_pipeline_seriousness:  pipelineRaw,
    document_readiness:         docRaw,
    meeting_traction:           meetingRaw,
    capital_connector_progress: ccRaw,
  };

  const score = Math.round(
    Object.entries(CREDIBILITY_WEIGHTS).reduce((sum, [key, w]) =>
      sum + (components[key] ?? 0) * (w / 100), 0
    )
  );

  const label = credibilityLabel(score);
  const gaps  = _credibilityGaps(components);

  // ── Downstream weighting hooks ─────────────────────────────────────────────
  // Callers can use these multipliers to adjust action urgency.
  const downstream = {
    board_outreach_urgency:     _urgencyFromScore(ivRaw, 'board'),
    investor_readiness_boost:   score >= 70 ? 1.25 : score >= 50 ? 1.0 : 0.75,
    warm_intro_ask_confidence:  score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low',
    next_action_credibility_weight: score / 100,
  };

  return { score, label, components, downstream, gaps };
}

// ─── Simplified quick credibility estimate ────────────────────────────────────

/**
 * Fast estimate when full board state isn't available.
 * Useful for command center snapshots.
 */
export function quickCredibilityEstimate(store) {
  const contacts     = store.contacts ?? [];
  const deals        = store.deals ?? [];
  const meetings     = store.meetings ?? [];
  const documents    = store.documents ?? [];
  const investors    = store.investors ?? [];
  const settings     = store.settings ?? {};

  const confirmedBoard = (store.boardCandidates ?? []).filter((c) => c.status === 'confirmed').length;
  const boardRaw = _clamp(Math.min(1, confirmedBoard / 3) * 100);

  return calcCredibilityIndex({
    boardState: { score: boardRaw, analyzed_seats: [] },
    settings,
    deals,
    meetings,
    documents,
    investors,
    contacts,
    thesisText: settings.dealThesis ?? settings.thesis ?? '',
  });
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _clamp(v) { return Math.max(0, Math.min(100, Math.round(v ?? 0))); }

function _thesisClarity(thesisText, settings) {
  const text = thesisText || settings.dealThesis || settings.thesis || '';
  if (!text) return 10;
  const words = text.trim().split(/\s+/).length;
  if (words >= 100) return 90;
  if (words >= 50)  return 70;
  if (words >= 20)  return 50;
  return 25;
}

function _estimateCapConnectorFromContacts(contacts) {
  const capitalTypes = ['capital_partner', 'banker'];
  const cc = contacts.filter((c) =>
    capitalTypes.includes(c.contactType ?? c.contact_type ?? '') &&
    (c.influenceScore ?? 0) >= 6
  );
  return _clamp(Math.min(1, cc.length / 2) * 100);
}

function _credibilityGaps(components) {
  const gaps = [];
  if (components.industry_veteran_progress < 50)  gaps.push('industry_veteran_missing');
  if (components.board_readiness < 40)            gaps.push('board_not_developing');
  if (components.thesis_clarity < 50)             gaps.push('thesis_not_clear');
  if (components.asset_completeness < 50)         gaps.push('assets_incomplete');
  if (components.deal_pipeline_seriousness < 40)  gaps.push('no_active_deal_pipeline');
  if (components.capital_connector_progress < 30) gaps.push('capital_connector_weak');
  if (components.meeting_traction < 30)           gaps.push('low_meeting_traction');
  return gaps;
}

function _urgencyFromScore(componentScore, domain) {
  if (componentScore >= 80) return 'low';
  if (componentScore >= 50) return 'medium';
  return domain === 'board' && componentScore < 20 ? 'critical' : 'high';
}

export default {
  CREDIBILITY_WEIGHTS,
  CREDIBILITY_LABELS,
  credibilityLabel,
  calcCredibilityIndex,
  quickCredibilityEstimate,
};
