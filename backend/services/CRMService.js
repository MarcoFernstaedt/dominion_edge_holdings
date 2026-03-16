/**
 * CRMService — Deterministic CRM logic. No AI calls.
 *
 * Handles: contact deduplication, relationship scoring, follow-up scheduling,
 * activity timeline, company status transitions.
 */

// ─── Contact similarity (deterministic) ──────────────────────────────────────
/**
 * Detect potential duplicate contacts by email, phone, or name similarity.
 * Returns pairs with a similarity score.
 */
export function findDuplicates(contacts) {
  const duplicates = [];
  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const score = _similarityScore(contacts[i], contacts[j]);
      if (score >= 0.8) {
        duplicates.push({ a: contacts[i].id, b: contacts[j].id, score, reason: _similarityReason(contacts[i], contacts[j]) });
      }
    }
  }
  return duplicates;
}

function _normalizeEmail(email) { return (email || '').toLowerCase().trim(); }
function _normalizeName(s)      { return (s || '').toLowerCase().replace(/[^a-z]/g, ''); }

function _similarityScore(a, b) {
  if (a.email && b.email && _normalizeEmail(a.email) === _normalizeEmail(b.email)) return 1.0;
  if (a.phone && b.phone && a.phone.replace(/\D/g, '') === b.phone.replace(/\D/g, '')) return 0.95;
  const nameA = _normalizeName(`${a.firstName}${a.lastName}`);
  const nameB = _normalizeName(`${b.firstName}${b.lastName}`);
  if (nameA && nameB && nameA === nameB) return 0.85;
  return 0;
}

function _similarityReason(a, b) {
  if (_normalizeEmail(a.email) === _normalizeEmail(b.email)) return 'same_email';
  if (a.phone?.replace(/\D/g, '') === b.phone?.replace(/\D/g, '')) return 'same_phone';
  return 'same_name';
}

// ─── Staleness detection (deterministic) ──────────────────────────────────────
const STALE_THRESHOLDS_DAYS = {
  active_pipeline: 14,
  warm_lead:       42,
  target:          84,
  default:         60,
};

export function classifyStaleness(contactOrCompany, lastInteractionDate) {
  const statusToThreshold = {
    conversation:  'active_pipeline',
    interested:    'active_pipeline',
    diligence:     'active_pipeline',
    under_loi:     'active_pipeline',
    contacted:     'warm_lead',
    target:        'target',
  };
  const tier      = statusToThreshold[contactOrCompany.status] || 'default';
  const threshold = STALE_THRESHOLDS_DAYS[tier] || STALE_THRESHOLDS_DAYS.default;
  const daysSince = lastInteractionDate
    ? (Date.now() - new Date(lastInteractionDate).getTime()) / 86400000
    : 999;

  return {
    isStale: daysSince > threshold,
    daysSince: Math.round(daysSince),
    threshold,
    tier,
    urgency: daysSince > threshold * 2 ? 'critical' : daysSince > threshold ? 'high' : 'ok',
  };
}

// ─── Follow-up scheduling (deterministic) ────────────────────────────────────
/**
 * Calculate the next recommended follow-up date.
 * Returns an ISO string.
 */
export function nextFollowUpDate(status, lastContactDate) {
  const daysMap = {
    active_pipeline: 7,
    warm_lead:       21,
    target:          45,
    default:         30,
  };
  const statusToTier = {
    conversation: 'active_pipeline',
    interested:   'active_pipeline',
    diligence:    'active_pipeline',
    contacted:    'warm_lead',
    target:       'target',
  };
  const tier = statusToTier[status] || 'default';
  const days = daysMap[tier];
  const base = lastContactDate ? new Date(lastContactDate) : new Date();
  return new Date(base.getTime() + days * 86400000).toISOString();
}

// ─── Company status machine ───────────────────────────────────────────────────
export const COMPANY_STATUSES = [
  'target', 'contacted', 'conversation', 'interested',
  'diligence', 'under_loi', 'under_contract', 'closed', 'lost', 'archived',
];

export function isValidStatusTransition(from, to) {
  const fromIdx = COMPANY_STATUSES.indexOf(from);
  const toIdx   = COMPANY_STATUSES.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  if (to === 'lost' || to === 'archived') return true;  // always allowed
  return toIdx >= fromIdx;
}

// ─── Activity timeline builder (deterministic) ───────────────────────────────
export function buildTimeline(interactions, meetings, tasks) {
  const events = [
    ...(interactions || []).map((i) => ({ type: 'interaction', date: i.createdAt, data: i })),
    ...(meetings || []).filter((m) => m.status === 'completed').map((m) => ({ type: 'meeting', date: m.startsAt, data: m })),
    ...(tasks || []).filter((t) => t.status === 'done').map((t) => ({ type: 'task', date: t.completedAt || t.updatedAt, data: t })),
  ];
  return events.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export const CRMService = { findDuplicates, classifyStaleness, nextFollowUpDate, isValidStatusTransition, buildTimeline, COMPANY_STATUSES };
export default CRMService;
