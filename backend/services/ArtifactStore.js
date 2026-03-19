/**
 * ArtifactStore — versioned, provenanced artifact registry.
 *
 * Rules:
 *  - Every generated artifact must have freshness and provenance metadata.
 *  - New generation creates a new version — never silent overwrites.
 *  - Retain latest_version, approved_version, and last_sent_version.
 *  - Artifact types are validated against known list.
 *  - Approval status is tracked here; ApprovalService manages transitions.
 *  - Stale artifacts warn before approval if source records changed.
 */

import { isStale, stalenessWarning } from './AgentOutputSchema.js';

// ─── Artifact types ───────────────────────────────────────────────────────────

export const ARTIFACT_TYPES = new Set([
  'email_draft',
  'letter_draft',
  'memo',
  'pitch_deck_outline',
  'meeting_prep',
  'meeting_summary',
  'board_update',
  'deal_summary',
  'underwriting_commentary',
  'diligence_summary',
  'seller_question_list',
  'operating_plan',
  'execution_brief',
]);

// ─── Approval status values (mirrors ApprovalService) ────────────────────────

export const APPROVAL_STATUS = {
  DRAFT:              'draft',
  SUBMITTED:          'submitted',
  APPROVED:           'approved',
  REJECTED:           'rejected',
  REVISION_REQUESTED: 'revision_requested',
  APPLIED:            'applied',
  EXPIRED:            'expired',
};

// ─── In-memory store (replace with DB in production) ─────────────────────────

const _artifacts = [];

// ─── ID generator ─────────────────────────────────────────────────────────────

function _id() {
  return `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function _snap(content) {
  // Lightweight hash of content for provenance tracking
  const s = typeof content === 'string' ? content : JSON.stringify(content);
  let h = 0;
  for (let i = 0; i < Math.min(s.length, 2000); i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return `snap_${Math.abs(h).toString(16)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new artifact (always creates version 1 or increments if groupId provided).
 *
 * @param {object} params
 * @param {string}  params.artifactType        — from ARTIFACT_TYPES
 * @param {string}  params.title
 * @param {string[]} params.linkedEntityTypes
 * @param {string[]} params.linkedEntityIds
 * @param {any}     params.content
 * @param {string}  [params.format]            — 'json' | 'markdown' | 'text'
 * @param {string}  [params.generatedByAgent]
 * @param {string}  [params.promptKey]
 * @param {string}  [params.promptVersion]
 * @param {string}  [params.providerUsed]
 * @param {string}  [params.modelUsed]
 * @param {boolean} [params.fallbackUsed]
 * @param {string}  [params.staleAfter]        — ISO timestamp
 * @param {number}  [params.staleHours]        — hours until stale (default 24)
 * @param {boolean} [params.approvalRequired]
 * @param {string}  [params.groupId]           — link to previous version group
 * @param {string}  [params.agentRunId]
 * @param {string}  [params.sourceSnapshotHash]
 * @returns {ArtifactRecord}
 */
export function create({
  artifactType,
  title,
  linkedEntityTypes = [],
  linkedEntityIds   = [],
  content,
  format            = 'json',
  generatedByAgent  = null,
  promptKey         = null,
  promptVersion     = null,
  providerUsed      = null,
  modelUsed         = null,
  fallbackUsed      = false,
  staleAfter        = null,
  staleHours        = 24,
  approvalRequired  = false,
  groupId           = null,
  agentRunId        = null,
  sourceSnapshotHash = null,
}) {
  if (!ARTIFACT_TYPES.has(artifactType)) {
    throw new Error(`Unknown artifact type: ${artifactType}. Valid: ${[...ARTIFACT_TYPES].join(', ')}`);
  }

  const now  = new Date().toISOString();
  const stale = staleAfter ?? new Date(Date.now() + staleHours * 3600_000).toISOString();

  // Determine version
  const gid     = groupId ?? _id();
  const siblings = _artifacts.filter((a) => a.groupId === gid);
  const version  = siblings.length + 1;

  const record = {
    artifactId:         _id(),
    groupId:            gid,
    version,
    artifactType,
    title,
    linkedEntityTypes,
    linkedEntityIds,
    content,
    format,
    generatedByAgent,
    promptKey,
    promptVersion,
    providerUsed,
    modelUsed,
    fallbackUsed,
    agentRunId,
    generatedAt:        now,
    staleAfter:         stale,
    sourceSnapshotHash: sourceSnapshotHash ?? _snap(content),
    approvalRequired,
    approvalStatus:     approvalRequired ? APPROVAL_STATUS.DRAFT : null,
    approvalId:         null,
    lastReviewedAt:     null,
    exportStatus:       null,

    // Version pointers — updated by promote* helpers
    isLatestVersion:    true,
    approvedVersion:    null,
    lastSentVersion:    null,

    history: [{ event: 'created', at: now, version, by: 'system' }],
  };

  // Mark prior versions in group as no longer latest
  siblings.forEach((a) => { a.isLatestVersion = false; });

  _artifacts.push(record);
  return record;
}

/**
 * Get a single artifact by ID.
 */
export function getById(artifactId) {
  return _artifacts.find((a) => a.artifactId === artifactId) ?? null;
}

/**
 * Get all versions in a group, sorted oldest-first.
 */
export function getVersionHistory(groupId) {
  return _artifacts
    .filter((a) => a.groupId === groupId)
    .sort((a, b) => a.version - b.version);
}

/**
 * Get the latest version for a group.
 */
export function getLatest(groupId) {
  return _artifacts
    .filter((a) => a.groupId === groupId)
    .sort((a, b) => b.version - a.version)[0] ?? null;
}

/**
 * Update the approval status on an artifact.
 * Called by ApprovalService after state transitions.
 */
export function setApprovalStatus(artifactId, status, { approvalId = null, reviewedAt = null } = {}) {
  const art = _find(artifactId);
  art.approvalStatus = status;
  if (approvalId) art.approvalId = approvalId;
  if (reviewedAt) art.lastReviewedAt = reviewedAt;

  const now = new Date().toISOString();
  art.history.push({ event: `approval_${status}`, at: now, by: 'system', approvalId });

  if (status === APPROVAL_STATUS.APPROVED) {
    // Mark approved version on all siblings
    _artifacts
      .filter((a) => a.groupId === art.groupId)
      .forEach((a) => { a.approvedVersion = art.version; });
  }
  return art;
}

/**
 * Mark an artifact as sent (for outreach / email drafts).
 */
export function markSent(artifactId, { sentAt = null, sentBy = 'system' } = {}) {
  const art = _find(artifactId);
  const now = sentAt ?? new Date().toISOString();
  art.exportStatus = 'sent';
  // Mark last_sent_version on all siblings
  _artifacts
    .filter((a) => a.groupId === art.groupId)
    .forEach((a) => { a.lastSentVersion = art.version; });
  art.history.push({ event: 'sent', at: now, by: sentBy });
  return art;
}

/**
 * Query artifacts.
 */
export function query({
  artifactType      = null,
  approvalStatus    = null,
  linkedEntityId    = null,
  generatedByAgent  = null,
  approvalRequired  = null,
  includeStale      = true,
  latestOnly        = true,
  limit             = 50,
  offset            = 0,
} = {}) {
  let results = [..._artifacts].reverse();

  if (latestOnly)                    results = results.filter((a) => a.isLatestVersion);
  if (artifactType)                  results = results.filter((a) => a.artifactType === artifactType);
  if (approvalStatus)                results = results.filter((a) => a.approvalStatus === approvalStatus);
  if (linkedEntityId)                results = results.filter((a) => a.linkedEntityIds.includes(linkedEntityId));
  if (generatedByAgent)              results = results.filter((a) => a.generatedByAgent === generatedByAgent);
  if (approvalRequired !== null)     results = results.filter((a) => a.approvalRequired === approvalRequired);
  if (!includeStale)                 results = results.filter((a) => !isStale({ stale_after: a.staleAfter }));

  return {
    total:  results.length,
    items:  results.slice(offset, offset + limit),
  };
}

/**
 * Get staleness info for an artifact — safe to call from UI.
 */
export function getStaleness(artifactId) {
  const art = _find(artifactId);
  const stale   = isStale({ stale_after: art.staleAfter });
  const warning = stalenessWarning({ stale_after: art.staleAfter });
  return { isStale: stale, staleAfter: art.staleAfter, warning };
}

/**
 * Return a minimal preview-safe summary of an artifact.
 */
export function getSummary(artifactId) {
  const art = _find(artifactId);
  const { isStale: stale, warning } = getStaleness(artifactId);
  return {
    artifactId:        art.artifactId,
    groupId:           art.groupId,
    version:           art.version,
    artifactType:      art.artifactType,
    title:             art.title,
    linkedEntityTypes: art.linkedEntityTypes,
    linkedEntityIds:   art.linkedEntityIds,
    generatedByAgent:  art.generatedByAgent,
    generatedAt:       art.generatedAt,
    staleAfter:        art.staleAfter,
    isStale:           stale,
    stalenessWarning:  warning,
    approvalRequired:  art.approvalRequired,
    approvalStatus:    art.approvalStatus,
    fallbackUsed:      art.fallbackUsed,
    format:            art.format,
    isLatestVersion:   art.isLatestVersion,
    approvedVersion:   art.approvedVersion,
    lastSentVersion:   art.lastSentVersion,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _find(artifactId) {
  const art = _artifacts.find((a) => a.artifactId === artifactId);
  if (!art) throw new Error(`Artifact not found: ${artifactId}`);
  return art;
}

export default {
  ARTIFACT_TYPES, APPROVAL_STATUS,
  create, getById, getVersionHistory, getLatest,
  setApprovalStatus, markSent,
  query, getStaleness, getSummary,
};
