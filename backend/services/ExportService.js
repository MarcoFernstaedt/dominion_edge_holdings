/**
 * ExportService
 *
 * Manages export records for artifacts leaving the system.
 *
 * Responsibilities:
 *  - Eligibility gating: approval-required artifacts must be approved first
 *  - Stale detection: warns (never blocks) if artifact is stale at export time
 *  - Version preservation: records exact version/snapshot at time of export
 *  - Audit trail: all export events logged with full provenance
 *
 * Export types: email / pdf / docx / clipboard / external_crm / board_portal / lender_portal
 * Export states: queued / ready / exported / failed / cancelled
 */

import ArtifactStore, { computeSnapshotHash } from './ArtifactStore.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const EXPORT_TYPES = new Set([
  'email',
  'pdf',
  'docx',
  'clipboard',
  'external_crm',
  'board_portal',
  'lender_portal',
  'investor_portal',
  'plain_text',
]);

export const EXPORT_STATES = {
  QUEUED:    'queued',
  READY:     'ready',
  EXPORTED:  'exported',
  FAILED:    'failed',
  CANCELLED: 'cancelled',
};

// Artifact types that require explicit approval before any external export
const APPROVAL_REQUIRED_TYPES = new Set([
  'email_draft',
  'letter_draft',
  'memo',
  'pitch_deck_outline',
  'board_pitch',
  'investor_update',
  'intro_request_draft',
  'LOI_support_summary',
]);

// Export types considered "external" (triggers approval gate)
const EXTERNAL_EXPORT_TYPES = new Set([
  'email',
  'pdf',
  'docx',
  'external_crm',
  'board_portal',
  'lender_portal',
  'investor_portal',
]);

// ─── In-memory store ──────────────────────────────────────────────────────────

let _exports = [];

// ─── Eligibility ──────────────────────────────────────────────────────────────

/**
 * Check if an artifact is eligible for export.
 *
 * @param {object} artifact  - full artifact record from ArtifactStore
 * @param {string} exportType
 * @returns {{ eligible: boolean, reason: string|null, warnings: string[] }}
 */
export function checkExportEligibility(artifact, exportType) {
  const warnings = [];

  if (!artifact) {
    return { eligible: false, reason: 'artifact_not_found', warnings };
  }

  if (artifact.status === 'archived') {
    return { eligible: false, reason: 'artifact_archived', warnings };
  }

  const isExternal = EXTERNAL_EXPORT_TYPES.has(exportType);
  const requiresApproval = APPROVAL_REQUIRED_TYPES.has(artifact.artifactType);

  // Gate: external export of approval-required artifact must be approved
  if (isExternal && requiresApproval) {
    const approvalState = artifact.approvalStatus ?? artifact.approval_status;
    if (approvalState !== 'approved') {
      return {
        eligible: false,
        reason: 'approval_required_before_external_export',
        warnings,
        detail: `Artifact type '${artifact.artifactType}' must be approved before exporting as '${exportType}'. Current approval status: ${approvalState ?? 'none'}.`,
      };
    }
  }

  // Warn: stale artifact
  const stalenessHours = artifact.staleAfterHours ?? 72;
  if (artifact.createdAt) {
    const ageHours = (Date.now() - new Date(artifact.createdAt).getTime()) / 3_600_000;
    if (artifact.status === 'stale' || ageHours > stalenessHours) {
      warnings.push('artifact_may_be_stale_review_before_sending');
    }
  }

  // Warn: revision-requested artifacts being re-exported without revision
  if (artifact.approvalStatus === 'revision_requested') {
    warnings.push('artifact_has_outstanding_revision_request');
  }

  return { eligible: true, reason: null, warnings };
}

// ─── Core export operations ───────────────────────────────────────────────────

/**
 * Queue an export for an artifact.
 *
 * @param {object} params
 * @param {string}   params.artifactId
 * @param {string}   params.exportType         - one of EXPORT_TYPES
 * @param {string}   params.requestedBy        - user identifier
 * @param {string}  [params.destination]       - email address, portal URL, etc.
 * @param {object}  [params.exportOptions]     - format hints, subject line, etc.
 * @param {object}  [params.artifactStore]     - injectable store (defaults to module store)
 *
 * @returns {{ export: object|null, eligible: boolean, reason: string|null, warnings: string[] }}
 */
export function queueExport({
  artifactId,
  exportType,
  requestedBy,
  destination   = null,
  exportOptions = {},
  artifactStore = ArtifactStore,
} = {}) {
  if (!EXPORT_TYPES.has(exportType)) {
    return { export: null, eligible: false, reason: `unknown_export_type: ${exportType}`, warnings: [] };
  }

  const artifact = artifactStore.getById(artifactId);
  const { eligible, reason, warnings, detail } = checkExportEligibility(artifact, exportType);

  if (!eligible) {
    return { export: null, eligible, reason, warnings, detail };
  }

  // Snapshot the artifact state at queue time for provenance
  const snapshotContent = artifact.content ?? artifact.body ?? '';
  const sourceSnapshotHashAtExport = computeSnapshotHash(
    typeof snapshotContent === 'string' ? snapshotContent : JSON.stringify(snapshotContent)
  );

  const record = {
    export_id:                     `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    artifact_id:                   artifactId,
    artifact_type:                 artifact.artifactType,
    export_type:                   exportType,
    requested_by:                  requestedBy,
    requested_at:                  new Date().toISOString(),
    completed_at:                  null,
    status:                        EXPORT_STATES.QUEUED,
    destination,
    export_options:                exportOptions,
    // Provenance snapshot at time of export
    version_exported:              artifact.version ?? artifact.versionNumber ?? 1,
    approval_state_at_export:      artifact.approvalStatus ?? artifact.approval_status ?? null,
    source_snapshot_hash_at_export: sourceSnapshotHashAtExport,
    artifact_status_at_export:     artifact.status,
    // Stale context
    stale_warning_at_export:       warnings.includes('artifact_may_be_stale_review_before_sending'),
    warnings,
    // Audit
    events: [
      {
        event:      'queued',
        at:         new Date().toISOString(),
        by:         requestedBy,
        note:       null,
      },
    ],
  };

  _exports.push(record);
  return { export: record, eligible: true, reason: null, warnings };
}

/**
 * Mark a queued export as ready (pre-flight checks passed, ready to transmit).
 */
export function markReady(exportId, { by = null, note = null } = {}) {
  return _transition(exportId, EXPORT_STATES.READY, { by, note });
}

/**
 * Complete an export (transmission confirmed).
 */
export function markExported(exportId, { by = null, note = null, destination = null } = {}) {
  const record = _transition(exportId, EXPORT_STATES.EXPORTED, { by, note });
  if (record) {
    record.completed_at = new Date().toISOString();
    if (destination) record.destination = destination;

    // Also mark the source artifact as sent/exported in ArtifactStore
    try {
      ArtifactStore.markExported(record.artifact_id, {
        exportedAt: record.completed_at,
        exportedBy: by,
        exportType: record.export_type,
        exportId,
      });
    } catch (_) {
      // ArtifactStore update is best-effort; export record stands
    }
  }
  return record;
}

/**
 * Fail an export (transmission error).
 */
export function failExport(exportId, { by = null, reason = null } = {}) {
  return _transition(exportId, EXPORT_STATES.FAILED, { by, note: reason });
}

/**
 * Cancel a queued export.
 */
export function cancelExport(exportId, { by = null, reason = null } = {}) {
  return _transition(exportId, EXPORT_STATES.CANCELLED, { by, note: reason });
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get a single export record by ID.
 */
export function getById(exportId) {
  return _exports.find((e) => e.export_id === exportId) ?? null;
}

/**
 * Get all exports for a given artifact.
 */
export function getByArtifact(artifactId) {
  return _exports.filter((e) => e.artifact_id === artifactId);
}

/**
 * Get the most recent successful export for an artifact.
 */
export function getLastExport(artifactId) {
  return _exports
    .filter((e) => e.artifact_id === artifactId && e.status === EXPORT_STATES.EXPORTED)
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0] ?? null;
}

/**
 * Get all exports, optionally filtered.
 *
 * @param {object} filters
 * @param {string}  [filters.status]       - EXPORT_STATES value
 * @param {string}  [filters.exportType]
 * @param {string}  [filters.requestedBy]
 * @param {boolean} [filters.staleOnly]    - only exports with stale_warning_at_export
 */
export function query(filters = {}) {
  let results = [..._exports];

  if (filters.status)      results = results.filter((e) => e.status === filters.status);
  if (filters.exportType)  results = results.filter((e) => e.export_type === filters.exportType);
  if (filters.requestedBy) results = results.filter((e) => e.requested_by === filters.requestedBy);
  if (filters.staleOnly)   results = results.filter((e) => e.stale_warning_at_export);

  return results.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));
}

/**
 * Get export audit trail for a single export record.
 */
export function getAuditTrail(exportId) {
  const record = getById(exportId);
  if (!record) return null;
  return {
    export_id:     record.export_id,
    artifact_id:   record.artifact_id,
    artifact_type: record.artifact_type,
    export_type:   record.export_type,
    requested_by:  record.requested_by,
    requested_at:  record.requested_at,
    completed_at:  record.completed_at,
    status:        record.status,
    destination:   record.destination,
    events:        record.events,
    provenance: {
      version_exported:               record.version_exported,
      approval_state_at_export:       record.approval_state_at_export,
      source_snapshot_hash_at_export: record.source_snapshot_hash_at_export,
      artifact_status_at_export:      record.artifact_status_at_export,
      stale_warning_at_export:        record.stale_warning_at_export,
    },
  };
}

/**
 * Get a summary of all exports (for dashboard / command center).
 */
export function getSummary() {
  const total     = _exports.length;
  const byStatus  = {};
  const byType    = {};
  let staleExports = 0;

  for (const e of _exports) {
    byStatus[e.status]      = (byStatus[e.status] ?? 0) + 1;
    byType[e.export_type]   = (byType[e.export_type] ?? 0) + 1;
    if (e.stale_warning_at_export) staleExports++;
  }

  return { total, byStatus, byType, stale_exports_count: staleExports };
}

// ─── Private ──────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS = {
  [EXPORT_STATES.QUEUED]:    [EXPORT_STATES.READY, EXPORT_STATES.FAILED, EXPORT_STATES.CANCELLED],
  [EXPORT_STATES.READY]:     [EXPORT_STATES.EXPORTED, EXPORT_STATES.FAILED, EXPORT_STATES.CANCELLED],
  [EXPORT_STATES.EXPORTED]:  [],
  [EXPORT_STATES.FAILED]:    [EXPORT_STATES.QUEUED],  // allow re-queue
  [EXPORT_STATES.CANCELLED]: [],
};

function _transition(exportId, toState, { by = null, note = null } = {}) {
  const record = _exports.find((e) => e.export_id === exportId);
  if (!record) return null;

  const allowed = VALID_TRANSITIONS[record.status] ?? [];
  if (!allowed.includes(toState)) {
    throw new Error(
      `ExportService: invalid transition ${record.status} → ${toState} for export ${exportId}`
    );
  }

  record.status = toState;
  record.events.push({
    event: toState,
    at:    new Date().toISOString(),
    by,
    note,
  });

  return record;
}

// ─── Reset (test / dev) ───────────────────────────────────────────────────────

export function _reset() {
  _exports = [];
}

// ─── Default export ───────────────────────────────────────────────────────────

export default {
  EXPORT_TYPES,
  EXPORT_STATES,
  checkExportEligibility,
  queueExport,
  markReady,
  markExported,
  failExport,
  cancelExport,
  getById,
  getByArtifact,
  getLastExport,
  query,
  getAuditTrail,
  getSummary,
  _reset,
};
