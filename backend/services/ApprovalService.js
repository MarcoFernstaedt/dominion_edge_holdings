/**
 * ApprovalService — gates outbound AI-generated actions behind human review.
 *
 * Approval-required actions:
 *   - outbound seller email
 *   - board invitation
 *   - investor outreach
 *   - external memo
 *   - capital structure recommendation artifact
 *   - any externally-visible document export
 *   - AI-proposed stage transitions (optional)
 *
 * NOT required:
 *   - internal summaries
 *   - meeting prep briefs
 *   - execution briefs
 *   - internal ranking commentary
 *   - issue grouping
 *   - internal next-step drafts
 *
 * Flow:
 *   1. Agent produces draft → createApproval()
 *   2. Reviewer: approve() | reject() | requestRevision()
 *   3. Only approved records may be sent/applied
 *   4. Full history preserved
 */

// helpers imported below for generateId

// ─── In-memory store (replace with DB in production) ─────────────────────────

const _approvals = [];

// ─── Action types that require approval ───────────────────────────────────────

export const APPROVAL_REQUIRED_TYPES = new Set([
  'seller_email',
  'board_invitation',
  'investor_outreach',
  'external_memo',
  'pitch_deck_share',
  'capital_stack_recommendation',
  'document_export',
  'loi_draft',
  'ai_stage_transition',
]);

// ─── Status values ────────────────────────────────────────────────────────────

export const STATUS = {
  PENDING:   'pending',
  APPROVED:  'approved',
  REJECTED:  'rejected',
  REVISION:  'revision_requested',
  EXPIRED:   'expired',
  WITHDRAWN: 'withdrawn',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function id() {
  return `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new approval record for an AI-generated draft.
 *
 * @param {object} params
 * @param {string} params.actionType         — from APPROVAL_REQUIRED_TYPES
 * @param {string} params.agentName          — which agent produced it
 * @param {string} params.promptKey
 * @param {string} params.promptVersion
 * @param {string} params.modelUsed
 * @param {boolean} params.fallbackUsed
 * @param {string} params.runId              — AgentRunLogger run_id
 * @param {object} params.draft              — the content to approve
 * @param {string} [params.entityType]       — e.g. 'contact', 'deal'
 * @param {string} [params.entityId]
 * @param {string} [params.recipientId]
 * @param {string} [params.recipientType]    — 'seller' | 'board_member' | 'investor'
 * @param {number} [params.expiresInHours]   — auto-expire (default 72h)
 * @returns {ApprovalRecord}
 */
export function createApproval({
  actionType,
  agentName,
  promptKey,
  promptVersion   = '1.0',
  modelUsed       = 'unknown',
  fallbackUsed    = false,
  runId           = null,
  draft,
  entityType      = null,
  entityId        = null,
  recipientId     = null,
  recipientType   = null,
  expiresInHours  = 72,
}) {
  if (!APPROVAL_REQUIRED_TYPES.has(actionType)) {
    // Caller should have checked first — warn but don't block
    console.warn(`[ApprovalService] createApproval called for non-required type: ${actionType}`);
  }

  const now    = new Date().toISOString();
  const expiry = new Date(Date.now() + expiresInHours * 3600_000).toISOString();

  const record = {
    id:             id(),
    actionType,
    status:         STATUS.PENDING,
    agentName,
    promptKey,
    promptVersion,
    modelUsed,
    fallbackUsed,
    runId,
    draft,
    entityType,
    entityId,
    recipientId,
    recipientType,
    createdAt:      now,
    expiresAt:      expiry,
    reviewedAt:     null,
    reviewedBy:     null,
    reviewNotes:    null,
    revisionNotes:  null,
    history:        [{ action: 'created', at: now, by: 'system' }],
  };

  _approvals.push(record);
  return record;
}

/**
 * Approve a pending draft.
 */
export function approve(approvalId, { reviewedBy = 'user', notes = null } = {}) {
  const rec = _find(approvalId);
  _assertPending(rec);
  _checkExpiry(rec);

  const now = new Date().toISOString();
  rec.status     = STATUS.APPROVED;
  rec.reviewedAt = now;
  rec.reviewedBy = reviewedBy;
  rec.reviewNotes= notes;
  rec.history.push({ action: 'approved', at: now, by: reviewedBy, notes });

  return rec;
}

/**
 * Reject a pending draft.
 */
export function reject(approvalId, { reviewedBy = 'user', reason = null } = {}) {
  const rec = _find(approvalId);
  _assertPending(rec);

  const now = new Date().toISOString();
  rec.status     = STATUS.REJECTED;
  rec.reviewedAt = now;
  rec.reviewedBy = reviewedBy;
  rec.reviewNotes= reason;
  rec.history.push({ action: 'rejected', at: now, by: reviewedBy, reason });

  return rec;
}

/**
 * Request a revision — agent should regenerate with the given notes.
 */
export function requestRevision(approvalId, { requestedBy = 'user', notes } = {}) {
  const rec = _find(approvalId);
  _assertPending(rec);

  const now = new Date().toISOString();
  rec.status        = STATUS.REVISION;
  rec.reviewedAt    = now;
  rec.reviewedBy    = requestedBy;
  rec.revisionNotes = notes;
  rec.history.push({ action: 'revision_requested', at: now, by: requestedBy, notes });

  return rec;
}

/**
 * Withdraw an approval record (before action is taken).
 */
export function withdraw(approvalId) {
  const rec = _find(approvalId);
  const now = new Date().toISOString();
  rec.status = STATUS.WITHDRAWN;
  rec.history.push({ action: 'withdrawn', at: now, by: 'system' });
  return rec;
}

/**
 * Check whether an action is allowed (approved and not expired).
 */
export function isAllowed(approvalId) {
  const rec = _approvals.find((r) => r.id === approvalId);
  if (!rec) return false;
  if (rec.status !== STATUS.APPROVED) return false;
  if (new Date(rec.expiresAt) < new Date()) return false;
  return true;
}

/**
 * Query approvals.
 */
export function query({
  status       = null,
  actionType   = null,
  entityId     = null,
  recipientType= null,
  limit        = 50,
  offset       = 0,
} = {}) {
  let results = [..._approvals].reverse();

  if (status)        results = results.filter((r) => r.status === status);
  if (actionType)    results = results.filter((r) => r.actionType === actionType);
  if (entityId)      results = results.filter((r) => r.entityId === entityId);
  if (recipientType) results = results.filter((r) => r.recipientType === recipientType);

  return {
    total:  results.length,
    pending: _approvals.filter((r) => r.status === STATUS.PENDING).length,
    items:  results.slice(offset, offset + limit),
  };
}

export function getById(approvalId) {
  return _approvals.find((r) => r.id === approvalId) ?? null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _find(approvalId) {
  const rec = _approvals.find((r) => r.id === approvalId);
  if (!rec) throw new Error(`Approval not found: ${approvalId}`);
  return rec;
}

function _assertPending(rec) {
  if (rec.status !== STATUS.PENDING && rec.status !== STATUS.REVISION) {
    throw new Error(`Approval ${rec.id} is not in a reviewable state (status: ${rec.status})`);
  }
}

function _checkExpiry(rec) {
  if (new Date(rec.expiresAt) < new Date()) {
    rec.status = STATUS.EXPIRED;
    throw new Error(`Approval ${rec.id} has expired`);
  }
}

export default {
  createApproval,
  approve,
  reject,
  requestRevision,
  withdraw,
  isAllowed,
  query,
  getById,
  APPROVAL_REQUIRED_TYPES,
  STATUS,
};
