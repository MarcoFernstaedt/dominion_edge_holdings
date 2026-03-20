/**
 * RelationshipScoring
 *
 * Deterministic scoring for contact relationships:
 *  - Relationship strength
 *  - Influence
 *  - Intro power
 *  - Advocate detection
 *  - Next-move engine
 *
 * Contacts are nodes in a leverage graph — not flat CRM rows.
 * All scoring is deterministic. AI may produce commentary, not scores.
 */

// ─── Relationship states ───────────────────────────────────────────────────────

export const RELATIONSHIP_STATES = [
  'identified',
  'known',
  'contacted',
  'engaged',
  'responsive',
  'trusted',
  'advocate',
  'cooling',
  'stalled',
  'archived',
];

// ─── Best-next-move action types ──────────────────────────────────────────────

export const NEXT_MOVE_TYPES = [
  'follow_up',
  'close_loop',
  'ask_for_intro',
  'share_progress_update',
  'meeting_request',
  'reengage',
  'thank_you_and_next_step',
  'archive',
];

// ─── Relationship strength score ─────────────────────────────────────────────
//
// Weights (sum 100):
//   recency              20
//   reply_rate           15
//   meeting_history      15
//   warmth               10
//   influence            15
//   trust_indicators     10
//   intro_power          10
//   positive_momentum     5

const STRENGTH_WEIGHTS = {
  recency:           20,
  reply_rate:        15,
  meeting_history:   15,
  warmth:            10,
  influence:         15,
  trust_indicators:  10,
  intro_power:       10,
  positive_momentum:  5,
};

/**
 * Compute relationship strength score for a contact.
 * @param {object}   contact     - contact record
 * @param {object[]} interactions - interaction records for this contact
 * @returns {{ score: number, label: string, components: object }}
 */
export function calcRelationshipStrength(contact, interactions = []) {
  const c = contact;

  const recencyScore      = _recencyScore(c.lastInteractionAt ?? c.last_interaction_at);
  const replyRate         = _replyRate(interactions);
  const meetingScore      = _meetingScore(interactions);
  const warmthScore       = _warmthScore(c.relationshipWarmth ?? c.relationship_warmth);
  const influenceScore    = _clamp((c.influenceScore ?? c.influence_score ?? 5) * 10);
  const trustScore        = _trustScore(c, interactions);
  const introScore        = _introPowerEstimate(c);
  const momentumScore     = _momentumScore(c, interactions);

  const components = {
    recency:           recencyScore,
    reply_rate:        replyRate,
    meeting_history:   meetingScore,
    warmth:            warmthScore,
    influence:         influenceScore,
    trust_indicators:  trustScore,
    intro_power:       introScore,
    positive_momentum: momentumScore,
  };

  const score = _weightedSum(components, STRENGTH_WEIGHTS);

  return { score: _clamp(score), label: _strengthLabel(score), components };
}

// ─── Influence score ──────────────────────────────────────────────────────────
//
// Weights (sum 100):
//   title_seniority      25
//   network_centrality   20
//   deal_relevance       15
//   capital_relevance    15
//   board_relevance      10
//   advocacy_behavior    10
//   intro_success_history 5

const INFLUENCE_WEIGHTS = {
  title_seniority:       25,
  network_centrality:    20,
  deal_relevance:        15,
  capital_relevance:     15,
  board_relevance:       10,
  advocacy_behavior:     10,
  intro_success_history:  5,
};

/**
 * Compute influence score for a contact.
 * @param {object} contact
 * @param {number} [centralityScore] - pre-computed centrality (0-100), optional
 * @returns {{ score: number, components: object }}
 */
export function calcInfluenceScore(contact, centralityScore) {
  const c = contact;

  const title_seniority      = _titleSeniorityScore(c.title);
  const network_centrality   = _clamp(centralityScore ?? (c.centrality_score ?? 50));
  const deal_relevance       = _contactTypeDealRelevance(c.contactType ?? c.contact_type);
  const capital_relevance    = _contactTypeCapitalRelevance(c.contactType ?? c.contact_type);
  const board_relevance      = _contactTypeBoardRelevance(c.contactType ?? c.contact_type);
  const advocacy_behavior    = _clamp((c.advocacy_score ?? 0));
  const intro_success_history = _clamp((c.intro_success_count ?? 0) * 20); // 5 successes = 100

  const components = {
    title_seniority, network_centrality, deal_relevance,
    capital_relevance, board_relevance, advocacy_behavior, intro_success_history,
  };

  const score = _weightedSum(components, INFLUENCE_WEIGHTS);
  return { score: _clamp(score), components };
}

// ─── Intro power score ────────────────────────────────────────────────────────
//
// Weights (sum 100):
//   network_reach            20
//   response_behavior        20
//   credibility              20
//   willingness_to_introduce 15
//   historical_follow_through 15
//   relevance                10

const INTRO_POWER_WEIGHTS = {
  network_reach:            20,
  response_behavior:        20,
  credibility:              20,
  willingness_to_introduce: 15,
  historical_follow_through:15,
  relevance:                10,
};

/**
 * Compute intro power for a contact — how useful they are as an introducer.
 */
export function calcIntroPower(contact, centralityScore) {
  const c = contact;

  const network_reach             = _clamp(centralityScore ?? c.centrality_score ?? 50);
  const response_behavior         = _warmthScore(c.relationshipWarmth ?? c.relationship_warmth);
  const credibility               = _clamp(c.influenceScore ? c.influenceScore * 10 : 50);
  const willingness_to_introduce  = c.is_advocate ? 80 : c.relationship_warmth === 'hot' ? 70 : 40;
  const historical_follow_through = _clamp((c.intro_success_count ?? 0) * 25);
  const relevance                 = _contactTypeBoardRelevance(c.contactType ?? c.contact_type);

  const components = {
    network_reach, response_behavior, credibility,
    willingness_to_introduce, historical_follow_through, relevance,
  };

  const score = _weightedSum(components, INTRO_POWER_WEIGHTS);
  return { score: _clamp(score), components };
}

// ─── Advocate detection ───────────────────────────────────────────────────────

/**
 * Determine if a contact qualifies as an advocate.
 * Rules:
 *   - trust score (from strength calc) ≥ 70
 *   - replied ≥ 2 times
 *   - at least one intro or meaningful help logged
 *   - positive engagement over time (warmth ≥ warm)
 */
export function isAdvocate(contact, interactions = []) {
  const warmth = contact.relationshipWarmth ?? contact.relationship_warmth ?? 'cold';
  const isWarm = ['warm', 'hot'].includes(warmth);
  const replies = interactions.filter((i) =>
    i.direction === 'inbound' || i.type === 'reply_received'
  ).length;
  const hasIntro = interactions.some((i) =>
    i.type === 'intro_made' || i.type === 'intro_requested' || i.activityType === 'intro_made'
  );
  const trustScore = _trustScore(contact, interactions);

  return (
    isWarm &&
    replies >= 2 &&
    (hasIntro || (contact.intro_success_count ?? 0) >= 1) &&
    trustScore >= 60
  );
}

/**
 * Enrich a contact with advocate status and leverage label.
 */
export function enrichContactLeverage(contact, interactions = [], centralityScore) {
  const strength  = calcRelationshipStrength(contact, interactions);
  const influence = calcInfluenceScore(contact, centralityScore);
  const introPow  = calcIntroPower(contact, centralityScore);
  const advocate  = isAdvocate(contact, interactions);

  const relationship_state = _deriveRelationshipState(contact, interactions, advocate);
  const leverage_score = Math.round(
    strength.score * 0.35 +
    influence.score * 0.35 +
    introPow.score * 0.30
  );

  return {
    ...contact,
    relationship_strength: strength.score,
    relationship_strength_label: strength.label,
    relationship_strength_components: strength.components,
    influence_score:    influence.score,
    influence_components: influence.components,
    intro_power_score:  introPow.score,
    intro_power_components: introPow.components,
    is_advocate:        advocate,
    relationship_state,
    leverage_score,
    leverage_label: leverage_score >= 70 ? 'high' : leverage_score >= 40 ? 'moderate' : 'low',
  };
}

// ─── Next-move engine ─────────────────────────────────────────────────────────

/**
 * Compute best next move for a contact.
 * @param {object}   contact
 * @param {object[]} interactions
 * @param {string[]} introTargets - IDs of contacts this person could introduce to
 * @returns {{ best_next_move, why_now, what_it_unblocks, warm_intro_targets_unlocked, touch_urgency, message_type }}
 */
export function calcNextMove(contact, interactions = [], introTargets = []) {
  const c       = contact;
  const warmth  = c.relationshipWarmth ?? c.relationship_warmth ?? 'cold';
  const state   = c.relationship_state ?? _deriveRelationshipState(c, interactions, false);
  const daysAgo = _daysSinceInteraction(c.lastInteractionAt ?? c.last_interaction_at);

  // Determine urgency
  const touch_urgency = _touchUrgency(state, daysAgo, warmth);

  // Choose best next move
  let best_next_move = 'follow_up';
  let why_now        = '';
  let what_it_unblocks = '';
  let message_type   = 'check_in';

  if (state === 'cooling' || state === 'stalled') {
    best_next_move   = 'reengage';
    why_now          = `Contact has been silent for ${Math.round(daysAgo)} days and is at risk of going cold.`;
    what_it_unblocks = 'Prevents permanent loss of a strategic relationship.';
    message_type     = 'reengagement';
  } else if (state === 'trusted' || state === 'advocate') {
    if (introTargets.length > 0) {
      best_next_move   = 'ask_for_intro';
      why_now          = 'Strong trusted relationship — highest probability of intro success.';
      what_it_unblocks = `Could unlock ${introTargets.length} target(s) without cold outreach.`;
      message_type     = 'intro_request';
    } else {
      best_next_move   = 'share_progress_update';
      why_now          = 'Advocate relationships benefit from being kept in the loop.';
      what_it_unblocks = 'Maintains trust and surfaces future intro opportunities.';
      message_type     = 'progress_update';
    }
  } else if (state === 'responsive' || state === 'engaged') {
    if (daysAgo > 7) {
      best_next_move   = 'follow_up';
      why_now          = 'Responsive contact who hasn\'t been touched recently.';
      what_it_unblocks = 'Advancing relationship to trusted tier unlocks intro asks.';
      message_type     = 'follow_up';
    } else if (introTargets.length > 0) {
      best_next_move   = 'ask_for_intro';
      why_now          = 'Engagement level is strong enough to make a warm ask.';
      what_it_unblocks = `Intro to ${introTargets.length} target(s).`;
      message_type     = 'intro_request';
    } else {
      best_next_move   = 'meeting_request';
      why_now          = 'Engagement level supports a meeting request now.';
      what_it_unblocks = 'In-person connection accelerates trust progression.';
      message_type     = 'meeting_request';
    }
  } else if (state === 'contacted') {
    if (daysAgo > 3) {
      best_next_move   = 'follow_up';
      why_now          = 'Outreach sent but no reply received yet.';
      what_it_unblocks = 'Getting a response moves this from cold to engaged.';
      message_type     = 'follow_up';
    } else {
      best_next_move   = 'close_loop';
      why_now          = 'Recent outreach — close loop to confirm receipt.';
      what_it_unblocks = 'Confirms contact is aware and prevents dropped thread.';
      message_type     = 'close_loop';
    }
  } else if (state === 'archived') {
    best_next_move   = 'archive';
    why_now          = 'Contact is archived — no action recommended.';
    what_it_unblocks = 'N/A';
    message_type     = 'none';
  }

  return {
    best_next_move,
    why_now,
    what_it_unblocks,
    warm_intro_targets_unlocked: introTargets,
    touch_urgency,
    message_type,
    relationship_state: state,
    days_since_last_touch: Math.round(daysAgo),
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _clamp(v) { return Math.max(0, Math.min(100, Math.round(v ?? 0))); }

function _weightedSum(components, weights) {
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (components[key] ?? 0) * (weight / 100);
  }
  return total;
}

function _recencyScore(lastInteractionAt) {
  if (!lastInteractionAt) return 0;
  const days = (Date.now() - new Date(lastInteractionAt).getTime()) / 86_400_000;
  if (days < 7)   return 100;
  if (days < 14)  return 80;
  if (days < 30)  return 60;
  if (days < 60)  return 40;
  if (days < 90)  return 25;
  return 10;
}

function _replyRate(interactions) {
  const outbound = interactions.filter((i) => i.direction === 'outbound').length;
  const inbound  = interactions.filter((i) => i.direction === 'inbound').length;
  if (outbound === 0) return 50;
  return _clamp((inbound / outbound) * 100);
}

function _meetingScore(interactions) {
  const meetings = interactions.filter((i) => i.type === 'meeting' || i.type === 'meeting_completed').length;
  if (meetings >= 4) return 100;
  if (meetings >= 2) return 75;
  if (meetings === 1) return 50;
  return 0;
}

function _warmthScore(warmth) {
  const map = { hot: 100, warm: 75, cooling: 40, cold: 15 };
  return map[warmth] ?? 30;
}

function _trustScore(contact, interactions) {
  let score = 0;
  const warmth = contact.relationshipWarmth ?? contact.relationship_warmth;
  score += _warmthScore(warmth) * 0.4;
  const replies = interactions.filter((i) => i.direction === 'inbound').length;
  score += Math.min(40, replies * 10);
  if (contact.intro_success_count > 0) score += 20;
  return _clamp(score);
}

function _introPowerEstimate(contact) {
  const ct = contact.contactType ?? contact.contact_type ?? '';
  const highPower = ['capital_partner', 'banker', 'attorney', 'networking_contact'];
  if (highPower.includes(ct)) return 70;
  return 40;
}

function _momentumScore(contact, interactions) {
  const recent = interactions.filter((i) => {
    const t = i.createdAt ?? i.created_at;
    if (!t) return false;
    return (Date.now() - new Date(t).getTime()) / 86_400_000 < 14;
  }).length;
  return _clamp(recent * 20);
}

function _titleSeniorityScore(title) {
  if (!title) return 40;
  const t = title.toLowerCase();
  if (t.includes('ceo') || t.includes('president') || t.includes('founder') || t.includes('partner')) return 90;
  if (t.includes('managing') || t.includes('principal') || t.includes('general partner')) return 80;
  if (t.includes('director') || t.includes('vp') || t.includes('vice president')) return 70;
  if (t.includes('senior') || t.includes('head of')) return 60;
  if (t.includes('manager')) return 45;
  return 40;
}

function _contactTypeDealRelevance(type) {
  const map = {
    banker: 90, attorney: 80, cpa: 75, capital_partner: 70,
    operator: 60, board_candidate: 65, seller: 80,
    networking_contact: 40, vendor: 20,
  };
  return map[type] ?? 30;
}

function _contactTypeCapitalRelevance(type) {
  const map = {
    capital_partner: 95, banker: 85, networking_contact: 50,
    board_candidate: 40, operator: 35, attorney: 30,
  };
  return map[type] ?? 20;
}

function _contactTypeBoardRelevance(type) {
  const map = {
    board_candidate: 90, operator: 70, networking_contact: 60,
    capital_partner: 55, banker: 50, attorney: 45, cpa: 40,
  };
  return map[type] ?? 25;
}

function _deriveRelationshipState(contact, interactions, advocate) {
  if (advocate) return 'advocate';

  const warmth   = contact.relationshipWarmth ?? contact.relationship_warmth ?? 'cold';
  const daysAgo  = _daysSinceInteraction(contact.lastInteractionAt ?? contact.last_interaction_at);
  const stage    = contact.relationshipStage ?? contact.relationship_stage ?? 'cold';

  if (['archived', 'not_interested'].includes(stage)) return 'archived';
  if (daysAgo > 60 && !['hot', 'warm'].includes(warmth)) return 'stalled';
  if (daysAgo > 30 && !['hot', 'warm'].includes(warmth)) return 'cooling';

  const inbound = interactions.filter((i) => i.direction === 'inbound').length;
  const outbound = interactions.filter((i) => i.direction === 'outbound').length;

  if (['trusted', 'long_term'].includes(stage) || warmth === 'hot') return 'trusted';
  if (inbound >= 2) return 'responsive';
  if (inbound >= 1 || ['active', 'relationship'].includes(stage)) return 'engaged';
  if (outbound >= 1 || stage === 'warming') return 'contacted';
  if (stage === 'aware') return 'known';
  return 'identified';
}

function _daysSinceInteraction(lastAt) {
  if (!lastAt) return 999;
  return (Date.now() - new Date(lastAt).getTime()) / 86_400_000;
}

function _touchUrgency(state, daysAgo, warmth) {
  if (state === 'cooling' && daysAgo > 14) return 'critical';
  if (state === 'stalled')                 return 'high';
  if (state === 'trusted' && daysAgo > 30) return 'high';
  if (state === 'advocate' && daysAgo > 20) return 'medium';
  if (daysAgo > 14)                        return 'medium';
  return 'low';
}

function _strengthLabel(score) {
  if (score >= 75) return 'strong';
  if (score >= 50) return 'moderate';
  if (score >= 25) return 'developing';
  return 'weak';
}

export default {
  RELATIONSHIP_STATES,
  NEXT_MOVE_TYPES,
  calcRelationshipStrength,
  calcInfluenceScore,
  calcIntroPower,
  isAdvocate,
  enrichContactLeverage,
  calcNextMove,
};
