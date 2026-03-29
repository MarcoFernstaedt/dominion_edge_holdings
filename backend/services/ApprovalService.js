/**
 * ApprovalService — explicit, auditable approval state machine.
 *
 * Approval-required artifacts and actions:
 *   - seller outbound messages
 *   - board invitations
 *   - investor outreach
 *   - external memos
 *   - external deck exports
 *   - AI-generated final structure recommendations for external use
 *   - AI-proposed major stage changes where configured
 *
 * NOT required:
 *   - internal summaries, meeting prep, execution briefs
 *   - internal ranking commentary, issue grouping, internal next-step drafts
 *
 * State machine:
 *   draft → submitted → approved → applied
 *                     ↘ rejected
 *                     ↘ revision_requested → submitted (re-submit cycle)
 *   Any non-terminal → expired (time-based)
 *
 * Rules:
 *   - reject() requires reason
 *   - requestRevision() requires instructions
 *   - apply() only callable on approved records
 *   - stale artifacts log warning before approval
 *   - full audit history on every record
 */

import * as ArtifactStore from './ArtifactStore.js';
import { stalenessWarning } from './AgentOutputSchema.js';

// ─── In-memory store (replace with DB in production) ─────────────────────────

const _approvals = [];

// ─── Approval scope catalog ───────────────────────────────────────────────────

export const APPROVAL_SCOPES = new Set([
  'send_message',
  'export_document',
  'apply_stage_change',
  'share_memo',
  'finalize_recommendation',
]);

// ─── Artifact / action types that require approval ────────────────────────────

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
  'email_draft',
  'letter_draft',
  'memo',
  'pitch_deck_outline',
]);

// ─── Status values ────────────────────────────────────────────────────────────

export const STATUS = {
  DRAFT:              'draft',
  SUBMITTED:          'submitted',
  APPROVED:           'approved',
  REJECTED:           'rejected',
  REVISION_REQUESTED: 'revision_requested',
  APPLIED:            'applied',
  EXPIRED:            'expired',
};

// Valid transitions: current state → allowed target states
const TRANSITIONS = {
  [STATUS.DRAFT]:              [STATUS.SUBMITTED, STATUS.EXPIRED],
  [STATUS.SUBMITTED]:          [STATUS.APPROVED, STATUS.REJECTED, STATUS.REVISION_REQUESTED, STATUS.EXPIRED],
  [STATUS.REVISION_REQUESTED]: [STATUS.SUBMITTED, STATUS.EXPIRED],
  [STATUS.APPROVED]:           [STATUS.APPLIED, STATUS.EXPIRED],
  [STATUS.REJECTED]:           [],
  [STATUS.APPLIED]:            [],
  [STATUS.EXPIRED]:            [],
};

// ─── ID generator ─────────────────────────────────────────────────────────────

function _id() {
  return `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new approval record for an AI-generated draft.
 *
 * @param {object}  params
 * @param {string}  params.artifactType         — artifact type being approved
 * @param {string}  [params.artifactId]         — linked ArtifactStore ID
 * @param {string}  [params.agentRunId]         — which agent run produced it
 * @param {string}  params.approvalScope        — from APPROVAL_SCOPES
 * @param {string}  [params.submittedBy]        — user or system that submitted
 * @param {string}  [params.reviewerId]         — assigned reviewer
 * @param {object}  params.draft               — content to approve
 * @param {string}  [params.agentName]
 * @param {string}  [params.promptKey]
 * @param {string}  [params.promptVersion]
 * @param {string}  [params.modelUsed]
 * @param {boolean} [params.fallbackUsed]
 * @param {string}  [params.entityType]
 * @param {string}  [params.entityId]
 * @param {string}  [params.recipientId]
 * @param {string}  [params.recipientType]     — 'seller'|'board_member'|'investor'
 * @param {string}  [params.sourceSnapshotHash]
 * @param {string}  [params.staleAfter]        — ISO timestamp
 * @param {number}  [params.expiresInHours]    — default 72h
 * @param {boolean} [params.autoSubmit]        — move directly to submitted
 * @returns {ApprovalRecord}
 */
export function createApproval({
  artifactType,
  artifactId         = null,
  agentRunId         = null,
  approvalScope      = null,
  submittedBy        = 'system',
  reviewerId         = null,
  draft,
  agentName          = null,
  promptKey          = null,
  promptVersion      = '1.0',
  modelUsed          = 'unknown',
  fallbackUsed       = false,
  entityType         = null,
  entityId           = null,
  recipientId        = null,
  recipientType      = null,
  sourceSnapshotHash = null,
  staleAfter         = null,
  expiresInHours     = 72,
  autoSubmit         = false,

  // Backwards-compat aliases from old API
  actionType         = null,
  runId              = null,
} = {}) {
  // Accept old actionType alias
  const resolvedType = artifactType ?? actionType;
  if (!resolvedType) throw new Error('artifactType is required');

  if (approvalScope && !APPROVAL_SCOPES.has(approvalScope)) {
    console.warn(`[ApprovalService] Unknown approval_scope: ${approvalScope}`);
  }
  if (!APPROVAL_REQUIRED_TYPES.has(resolvedType)) {
    console.warn(`[ApprovalService] createApproval called for unregistered type: ${resolvedType}`);
  }

  const now    = new Date().toISOString();
  const expiry = new Date(Date.now() + expiresInHours * 3600_000).toISOString();
  const initialStatus = autoSubmit ? STATUS.SUBMITTED : STATUS.DRAFT;

  const record = {
    id:                   _id(),
    version:              1,
    artifactType:         resolvedType,
    artifactId,
    agentRunId:           agentRunId ?? runId,
    approvalScope,
    status:               initialStatus,
    submittedBy,
    reviewerId,
    draft,
    agentName,
    promptKey,
    promptVersion,
    modelUsed,
    fallbackUsed,
    entityType,
    entityId,
    recipientId,
    recipientType,
    sourceSnapshotHash,
    staleAfter,
    createdAt:            now,
    submittedAt:          autoSubmit ? now : null,
    reviewedAt:           null,
    appliedAt:            null,
    expiresAt:            expiry,
    reviewNotes:          null,
    revisionInstructions: null,
    rejectionReason:      null,
    history: [
      { action: 'created', at: now, by: submittedBy, status: initialStatus },
      ...(autoSubmit ? [{ action: 'submitted', at: now, by: submittedBy, status: STATUS.SUBMITTED }] : []),
    ],
  };

  _approvals.push(record);
  _syncArtifact(record);
  return record;
}

/**
 * Submit a draft for review (draft → submitted).
 */
export function submit(approvalId, { submittedBy = 'user' } = {}) {
  const rec = _find(approvalId);
  _assertTransition(rec, STATUS.SUBMITTED);

  const now      = new Date().toISOString();
  rec.status     = STATUS.SUBMITTED;
  rec.submittedAt = now;
  rec.history.push({ action: 'submitted', at: now, by: submittedBy, status: STATUS.SUBMITTED });
  _syncArtifact(rec);
  return rec;
}

/**
 * Approve a submitted draft.
 */
export function approve(approvalId, { reviewedBy = 'user', notes = null } = {}) {
  const rec = _find(approvalId);
  _assertTransition(rec, STATUS.APPROVED);
  _checkExpiry(rec);
  _warnIfStale(rec);

  const now      = new Date().toISOString();
  rec.status     = STATUS.APPROVED;
  rec.reviewedAt = now;
  rec.reviewerId = reviewedBy;
  rec.reviewNotes = notes;
  rec.history.push({ action: 'approved', at: now, by: reviewedBy, notes, status: STATUS.APPROVED });
  _syncArtifact(rec, now);
  return rec;
}

/**
 * Reject a submitted draft. Reason is required.
 */
export function reject(approvalId, { reviewedBy = 'user', reason } = {}) {
  if (!reason) throw new Error('rejection reason is required');
  const rec = _find(approvalId);
  _assertTransition(rec, STATUS.REJECTED);

  const now            = new Date().toISOString();
  rec.status           = STATUS.REJECTED;
  rec.reviewedAt       = now;
  rec.reviewerId       = reviewedBy;
  rec.rejectionReason  = reason;
  rec.reviewNotes      = reason;
  rec.history.push({ action: 'rejected', at: now, by: reviewedBy, reason, status: STATUS.REJECTED });
  _syncArtifact(rec, now);
  return rec;
}

/**
 * Request a revision. Instructions are required.
 */
export function requestRevision(approvalId, { requestedBy = 'user', instructions, notes } = {}) {
  const resolvedInstructions = instructions ?? notes;
  if (!resolvedInstructions) throw new Error('revision instructions are required');
  const rec = _find(approvalId);
  _assertTransition(rec, STATUS.REVISION_REQUESTED);

  const now = new Date().toISOString();
  rec.status               = STATUS.REVISION_REQUESTED;
  rec.reviewedAt           = now;
  rec.reviewerId           = requestedBy;
  rec.revisionInstructions = resolvedInstructions;
  rec.history.push({ action: 'revision_requested', at: now, by: requestedBy, instructions: resolvedInstructions, status: STATUS.REVISION_REQUESTED });
  _syncArtifact(rec, now);
  return rec;
}

/**
 * Apply an approved draft (mark action as executed).
 */
export function apply(approvalId, { appliedBy = 'system' } = {}) {
  const rec = _find(approvalId);
  _assertTransition(rec, STATUS.APPLIED);

  const now   = new Date().toISOString();
  rec.status  = STATUS.APPLIED;
  rec.appliedAt = now;
  rec.history.push({ action: 'applied', at: now, by: appliedBy, status: STATUS.APPLIED });
  _syncArtifact(rec, now);
  return rec;
}

/**
 * Expire a record (manual or scheduled).
 */
export function expire(approvalId) {
  const rec = _find(approvalId);
  if (rec.status === STATUS.APPLIED || rec.status === STATUS.EXPIRED) return rec;
  const now  = new Date().toISOString();
  rec.status = STATUS.EXPIRED;
  rec.history.push({ action: 'expired', at: now, by: 'system', status: STATUS.EXPIRED });
  _syncArtifact(rec);
  return rec;
}

/**
 * Backwards-compat: withdraw (maps to expire for non-terminal records).
 */
export function withdraw(approvalId) {
  return expire(approvalId);
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
 * Get staleness warning if applicable.
 */
export function getStalenessWarning(approvalId) {
  const rec = _find(approvalId);
  if (!rec.staleAfter) return null;
  return stalenessWarning({ stale_after: rec.staleAfter });
}

/**
 * Query approvals with optional filters.
 */
export function query({
  status        = null,
  actionType    = null,   // backwards-compat alias for artifactType
  artifactType  = null,
  approvalScope = null,
  entityId      = null,
  recipientType = null,
  limit         = 50,
  offset        = 0,
} = {}) {
  let results = [..._approvals].reverse();
  const typeFilter = artifactType ?? actionType;

  if (status)      results = results.filter((r) => r.status === status);
  if (typeFilter)  results = results.filter((r) => r.artifactType === typeFilter);
  if (approvalScope) results = results.filter((r) => r.approvalScope === approvalScope);
  if (entityId)    results = results.filter((r) => r.entityId === entityId);
  if (recipientType) results = results.filter((r) => r.recipientType === recipientType);

  const pending = _approvals.filter((r) => r.status === STATUS.SUBMITTED).length;

  return {
    total:   results.length,
    pending,
    items:   results.slice(offset, offset + limit),
  };
}

export function getById(approvalId) {
  return _approvals.find((r) => r.id === approvalId) ?? null;
}

/**
 * Get full audit trail for an approval.
 */
export function getHistory(approvalId) {
  const rec = _find(approvalId);
  return { id: rec.id, version: rec.version, history: rec.history };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _find(approvalId) {
  const rec = _approvals.find((r) => r.id === approvalId);
  if (!rec) throw new Error(`Approval not found: ${approvalId}`);
  return rec;
}

function _assertTransition(rec, targetStatus) {
  const allowed = TRANSITIONS[rec.status] ?? [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Invalid transition: ${rec.status} → ${targetStatus} for approval ${rec.id}. ` +
      `Allowed: ${allowed.join(', ') || 'none'}`
    );
  }
}

function _checkExpiry(rec) {
  if (new Date(rec.expiresAt) < new Date()) {
    rec.status = STATUS.EXPIRED;
    rec.history.push({ action: 'expired', at: new Date().toISOString(), by: 'system', status: STATUS.EXPIRED });
    throw new Error(`Approval ${rec.id} has expired`);
  }
}

function _warnIfStale(rec) {
  if (!rec.staleAfter) return;
  const warning = stalenessWarning({ stale_after: rec.staleAfter });
  if (warning) console.warn(`[ApprovalService] Stale artifact approved: ${rec.id} — ${warning}`);
}

function _syncArtifact(rec, reviewedAt = null) {
  if (!rec.artifactId) return;
  try {
    ArtifactStore.setApprovalStatus(rec.artifactId, rec.status, {
      approvalId: rec.id,
      reviewedAt,
    });
  } catch {
    // non-fatal if artifact doesn't exist yet
  }
}

export default {
  STATUS, APPROVAL_SCOPES, APPROVAL_REQUIRED_TYPES,
  createApproval, submit, approve, reject, requestRevision, apply, expire, withdraw,
  isAllowed, getStalenessWarning,
  query, getById, getHistory,
};
