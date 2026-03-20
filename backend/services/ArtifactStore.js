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
 *  - Source snapshot hash detects when linked records changed since generation.
 */

import { isStale, stalenessWarning } from './AgentOutputSchema.js';

// ─── Artifact types ───────────────────────────────────────────────────────────

export const ARTIFACT_TYPES = new Set([
  // Communication
  'email_draft',
  'letter_draft',
  'intro_request_draft',
  'follow_up_sequence',

  // Deal artifacts
  'deal_summary',
  'underwriting_commentary',
  'diligence_summary',
  'seller_question_list',
  'capital_stack_summary',
  'LOI_support_summary',

  // Board artifacts
  'board_update',
  'board_pitch',

  // Investor artifacts
  'memo',
  'pitch_deck_outline',
  'investor_update',

  // Meeting artifacts
  'meeting_prep',
  'meeting_summary',

  // Operational artifacts
  'operating_plan',
  'execution_brief',
  'transition_plan',
]);

// ─── Artifact format types ────────────────────────────────────────────────────

export const ARTIFACT_FORMATS = new Set([
  'rich_text',
  'markdown',
  'html',
  'json',
  'plain_text',
  'structured_block',
]);

// ─── Artifact status values ───────────────────────────────────────────────────

export const ARTIFACT_STATUS = {
  DRAFT:                  'draft',
  READY:                  'ready',
  SUBMITTED_FOR_APPROVAL: 'submitted_for_approval',
  APPROVED:               'approved',
  REJECTED:               'rejected',
  REVISION_REQUESTED:     'revision_requested',
  SENT:                   'sent',
  EXPORTED:               'exported',
  STALE:                  'stale',
  ARCHIVED:               'archived',
};

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

// ─── Default stale-hours by artifact type ─────────────────────────────────────

const DEFAULT_STALE_HOURS = {
  meeting_prep:             24,
  meeting_summary:          48,
  execution_brief:           6,
  deal_summary:             48,
  underwriting_commentary:  48,
  diligence_summary:        24,
  board_update:             48,
  memo:                     72,
  pitch_deck_outline:       72,
  investor_update:          48,
  email_draft:              72,
  letter_draft:             72,
  intro_request_draft:      72,
  follow_up_sequence:       72,
  seller_question_list:     48,
  capital_stack_summary:    48,
  LOI_support_summary:      24,
  board_pitch:              72,
  operating_plan:          168,
  transition_plan:         168,
  default:                  24,
};

// ─── Approval-required artifact types ─────────────────────────────────────────

export const APPROVAL_REQUIRED_TYPES = new Set([
  'email_draft',
  'letter_draft',
  'memo',
  'pitch_deck_outline',
  'board_pitch',
  'investor_update',
  'intro_request_draft',
  'LOI_support_summary',
]);

// ─── In-memory store (replace with DB in production) ─────────────────────────

const _artifacts = [];

// ─── ID generator ─────────────────────────────────────────────────────────────

function _id() {
  return `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Lightweight content hash for provenance tracking.
 * Also used to detect when source record changed since generation.
 */
export function computeSnapshotHash(content) {
  const s = typeof content === 'string' ? content : JSON.stringify(content);
  let h = 0;
  for (let i = 0; i < Math.min(s.length, 4000); i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return `snap_${Math.abs(h).toString(16)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new artifact (always creates version 1 or increments if groupId provided).
 *
 * @param {object}   params
 * @param {string}   params.artifactType
 * @param {string}   params.title
 * @param {string[]} params.linkedEntityTypes
 * @param {string[]} params.linkedEntityIds
 * @param {any}      params.content
 * @param {string}   [params.format]            — from ARTIFACT_FORMATS (default: 'markdown')
 * @param {string}   [params.generatedByAgent]
 * @param {string}   [params.generatedBySystem]
 * @param {string}   [params.promptKey]
 * @param {string}   [params.promptVersion]
 * @param {string}   [params.providerUsed]
 * @param {string}   [params.modelUsed]
 * @param {boolean}  [params.fallbackUsed]
 * @param {string}   [params.staleAfter]        — ISO timestamp override
 * @param {number}   [params.staleHours]        — hours until stale (type default if omitted)
 * @param {boolean}  [params.approvalRequired]
 * @param {string}   [params.groupId]           — link to previous version group
 * @param {string}   [params.agentRunId]
 * @param {string}   [params.sourceSnapshotHash] — hash of source records at generation time
 * @param {string}   [params.revisionNotes]     — instructions from revision_requested
 * @param {string}   [params.createdBy]
 * @returns {ArtifactRecord}
 */
export function create({
  artifactType,
  title,
  linkedEntityTypes  = [],
  linkedEntityIds    = [],
  content,
  format             = 'markdown',
  generatedByAgent   = null,
  generatedBySystem  = null,
  promptKey          = null,
  promptVersion      = null,
  providerUsed       = null,
  modelUsed          = null,
  fallbackUsed       = false,
  staleAfter         = null,
  staleHours         = null,
  approvalRequired   = null,
  groupId            = null,
  agentRunId         = null,
  sourceSnapshotHash = null,
  revisionNotes      = null,
  createdBy          = 'system',
}) {
  if (!ARTIFACT_TYPES.has(artifactType)) {
    throw new Error(`Unknown artifact type: ${artifactType}. Valid: ${[...ARTIFACT_TYPES].join(', ')}`);
  }

  const now     = new Date().toISOString();
  const hours   = staleHours ?? DEFAULT_STALE_HOURS[artifactType] ?? DEFAULT_STALE_HOURS.default;
  const stale   = staleAfter ?? new Date(Date.now() + hours * 3_600_000).toISOString();
  const needsApproval = approvalRequired ?? APPROVAL_REQUIRED_TYPES.has(artifactType);

  // Determine version
  const gid      = groupId ?? _id();
  const siblings = _artifacts.filter((a) => a.groupId === gid);
  const version  = siblings.length + 1;

  const record = {
    artifactId:         _id(),
    groupId:            gid,
    version,

    // Identity
    artifactType,
    title,
    format:             ARTIFACT_FORMATS.has(format) ? format : 'markdown',

    // Linked source records
    linkedEntityTypes,
    linkedEntityIds,

    // Content
    content,

    // Provenance
    generatedByAgent,
    generatedBySystem,
    promptKey,
    promptVersion,
    providerUsed,
    modelUsed,
    fallbackUsed,
    agentRunId,
    createdBy,
    generatedAt:        now,

    // Freshness
    staleAfter:         stale,
    sourceSnapshotHash: sourceSnapshotHash ?? computeSnapshotHash(content),

    // Status
    status:             needsApproval ? ARTIFACT_STATUS.DRAFT : ARTIFACT_STATUS.READY,
    approvalRequired:   needsApproval,
    approvalStatus:     needsApproval ? APPROVAL_STATUS.DRAFT : null,
    approvalId:         null,
    lastReviewedAt:     null,
    exportStatus:       null,

    // Version pointers — updated by promote* helpers
    isLatestVersion:    true,
    approvedVersion:    null,
    lastSentVersion:    null,

    // Revision context
    revisionNotes,

    // Audit history
    history: [{ event: 'created', at: now, version, by: createdBy }],
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

  // Sync artifact status from approval status
  const statusMap = {
    [APPROVAL_STATUS.SUBMITTED]:          ARTIFACT_STATUS.SUBMITTED_FOR_APPROVAL,
    [APPROVAL_STATUS.APPROVED]:           ARTIFACT_STATUS.APPROVED,
    [APPROVAL_STATUS.REJECTED]:           ARTIFACT_STATUS.REJECTED,
    [APPROVAL_STATUS.REVISION_REQUESTED]: ARTIFACT_STATUS.REVISION_REQUESTED,
    [APPROVAL_STATUS.APPLIED]:            ARTIFACT_STATUS.SENT,
  };
  if (statusMap[status]) art.status = statusMap[status];

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
  art.status = ARTIFACT_STATUS.SENT;
  art.exportStatus = 'sent';
  _artifacts
    .filter((a) => a.groupId === art.groupId)
    .forEach((a) => { a.lastSentVersion = art.version; });
  art.history.push({ event: 'sent', at: now, by: sentBy });
  return art;
}

/**
 * Mark an artifact as exported.
 */
export function markExported(artifactId, { exportedAt = null, exportedBy = 'system', exportType = 'download', exportId = null } = {}) {
  const art = _find(artifactId);
  const now = exportedAt ?? new Date().toISOString();
  art.status = ARTIFACT_STATUS.EXPORTED;
  art.exportStatus = 'exported';
  art.history.push({ event: 'exported', at: now, by: exportedBy, exportType, exportId });
  return art;
}

/**
 * Archive an artifact (soft delete).
 */
export function archive(artifactId, { by = 'user', reason = null } = {}) {
  const art = _find(artifactId);
  const now = new Date().toISOString();
  art.status = ARTIFACT_STATUS.ARCHIVED;
  art.history.push({ event: 'archived', at: now, by, reason });
  return art;
}

/**
 * Mark artifact stale (called when source records change).
 */
export function markStale(artifactId, { reason = 'source_records_changed' } = {}) {
  const art = _find(artifactId);
  if (art.status === ARTIFACT_STATUS.ARCHIVED) return art;
  art.status = ARTIFACT_STATUS.STALE;
  const now = new Date().toISOString();
  art.history.push({ event: 'stale', at: now, by: 'system', reason });
  return art;
}

/**
 * Query artifacts.
 */
export function query({
  artifactType      = null,
  artifactStatus    = null,
  approvalStatus    = null,
  linkedEntityId    = null,
  generatedByAgent  = null,
  approvalRequired  = null,
  includeStale      = true,
  includeArchived   = false,
  latestOnly        = true,
  limit             = 50,
  offset            = 0,
} = {}) {
  let results = [..._artifacts].reverse();

  if (latestOnly)                    results = results.filter((a) => a.isLatestVersion);
  if (!includeArchived)              results = results.filter((a) => a.status !== ARTIFACT_STATUS.ARCHIVED);
  if (artifactType)                  results = results.filter((a) => a.artifactType === artifactType);
  if (artifactStatus)                results = results.filter((a) => a.status === artifactStatus);
  if (approvalStatus)                results = results.filter((a) => a.approvalStatus === approvalStatus);
  if (linkedEntityId)                results = results.filter((a) => (a.linkedEntityIds ?? []).includes(linkedEntityId));
  if (generatedByAgent)              results = results.filter((a) => a.generatedByAgent === generatedByAgent);
  if (approvalRequired !== null)     results = results.filter((a) => a.approvalRequired === approvalRequired);
  if (!includeStale)                 results = results.filter((a) => !isStale({ stale_after: a.staleAfter }));

  return {
    total:  results.length,
    items:  results.slice(offset, offset + limit),
  };
}

/**
 * Get staleness info for an artifact.
 * Also detects source hash change if currentSourceHash provided.
 */
export function getStaleness(artifactId, { currentSourceHash = null } = {}) {
  const art = _find(artifactId);
  const timeStale  = isStale({ stale_after: art.staleAfter });
  const hashStale  = currentSourceHash && art.sourceSnapshotHash
    ? currentSourceHash !== art.sourceSnapshotHash
    : false;
  const stale      = timeStale || hashStale;
  const warning    = stale
    ? 'This artifact may be outdated because linked records changed after generation. Review or regenerate before approval, sending, or export.'
    : null;

  return {
    isStale:      stale,
    timeStale,
    hashStale,
    staleAfter:   art.staleAfter,
    warning,
    sourceSnapshotHash:        art.sourceSnapshotHash,
    currentSourceHash:         currentSourceHash ?? null,
    sourceHashMismatch:        hashStale,
  };
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
    format:            art.format,
    status:            art.status,
    linkedEntityTypes: art.linkedEntityTypes,
    linkedEntityIds:   art.linkedEntityIds,
    generatedByAgent:  art.generatedByAgent,
    generatedBySystem: art.generatedBySystem,
    generatedAt:       art.generatedAt,
    staleAfter:        art.staleAfter,
    isStale:           stale,
    stalenessWarning:  warning,
    approvalRequired:  art.approvalRequired,
    approvalStatus:    art.approvalStatus,
    fallbackUsed:      art.fallbackUsed,
    providerUsed:      art.providerUsed,
    modelUsed:         art.modelUsed,
    isLatestVersion:   art.isLatestVersion,
    approvedVersion:   art.approvedVersion,
    lastSentVersion:   art.lastSentVersion,
    revisionNotes:     art.revisionNotes,
    sourceSnapshotHash:art.sourceSnapshotHash,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _find(artifactId) {
  const art = _artifacts.find((a) => a.artifactId === artifactId);
  if (!art) throw new Error(`Artifact not found: ${artifactId}`);
  return art;
}

export default {
  ARTIFACT_TYPES, ARTIFACT_FORMATS, ARTIFACT_STATUS, APPROVAL_STATUS,
  APPROVAL_REQUIRED_TYPES,
  computeSnapshotHash,
  create, getById, getVersionHistory, getLatest,
  setApprovalStatus, markSent, markExported, archive, markStale,
  query, getStaleness, getSummary,
};
