import { z }  from 'zod';
import store  from '../store.js';
import NotificationService from '../../services/NotificationService.js';
import * as ArtifactStore  from '../../services/ArtifactStore.js';
import ExportService       from '../../services/ExportService.js';
import { validate }        from '../middleware/validate.js';
import { errorResponse }   from '../middleware/errorResponse.js';
import { uid, nowIso }     from '../lib/helpers.js';

// ─── Notifications ────────────────────────────────────────────────────────────

export function list(req, res) {
  try {
    let notifs = [...(store.notifications ?? [])];
    const { unread, pinned, severity, type } = req.query;

    if (unread === 'true') notifs = notifs.filter((n) => !n.read_at);
    if (pinned === 'true') notifs = notifs.filter((n) => n.pinned);
    if (severity)          notifs = notifs.filter((n) => n.severity === severity);
    if (type)              notifs = notifs.filter((n) => n.type === type);

    notifs.sort((a, b) => new Date(b.createdAt ?? b.created_at) - new Date(a.createdAt ?? a.created_at));
    res.json({ notifications: notifs, total: notifs.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve notifications');
  }
}

export function markRead(req, res) {
  const notif = (store.notifications ?? []).find((n) => n.id === req.params.id);
  if (!notif) return errorResponse(res, 404, 'NOT_FOUND', 'Notification not found');
  NotificationService.markRead(notif);
  res.json({ id: notif.id, read_at: notif.read_at });
}

export function dismiss(req, res) {
  const notif = (store.notifications ?? []).find((n) => n.id === req.params.id);
  if (!notif) return errorResponse(res, 404, 'NOT_FOUND', 'Notification not found');
  NotificationService.markDismissed(notif);
  res.json({ id: notif.id, dismissed_at: notif.dismissed_at });
}

export function markAllRead(req, res) {
  const unread = (store.notifications ?? []).filter((n) => !n.read_at && !n.dismissed_at);
  unread.forEach((n) => NotificationService.markRead(n));
  res.json({ marked_read: unread.length });
}

// ─── Quick actions ────────────────────────────────────────────────────────────

export const quickLog = [
  validate(z.object({
    entity_type:      z.enum(['contact', 'deal', 'investor', 'board_candidate']),
    entity_id:        z.string().min(1),
    interaction_type: z.enum(['call', 'email', 'meeting', 'text', 'note', 'linkedin']),
    notes:            z.string().max(2000).optional(),
    sentiment:        z.enum(['positive', 'neutral', 'negative', 'hot', 'warm', 'cold']).optional(),
    logged_by:        z.string().max(200).optional(),
  })),
  (req, res) => {
    try {
      const { entity_type, entity_id, interaction_type, notes, sentiment, logged_by } = req.validated;
      const entry = {
        id: uid(),
        entity_type,
        entity_id,
        interaction_type,
        notes:            notes ?? '',
        sentiment:        sentiment ?? 'neutral',
        logged_by:        logged_by ?? 'user',
        logged_at:        nowIso(),
      };

      if (entity_type === 'contact') {
        store.interactions.push({ ...entry, contactId: entity_id });
      } else {
        store.interactions.push(entry);
      }

      res.status(201).json({ quick_log: entry });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to log quick interaction');
    }
  },
];

export const openNextAction = [
  validate(z.object({
    task_id:   z.string().min(1),
    opened_by: z.string().max(200).optional(),
    notes:     z.string().max(1000).optional(),
  })),
  (req, res) => {
    try {
      const { task_id, opened_by, notes } = req.validated;
      const task = (store.tasks ?? []).find((t) => t.id === task_id);
      if (!task) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');
      task.status     = 'in_progress';
      task.started_at = nowIso();
      task.started_by = opened_by ?? 'user';
      if (notes) task.notes = notes;
      res.json({ task_id, status: 'in_progress', started_at: task.started_at });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to open next action');
    }
  },
];

export const proofSubmit = [
  validate(z.object({
    task_id:      z.string().min(1),
    proof_type:   z.enum(['screenshot', 'email_thread', 'doc_link', 'verbal_confirm', 'system_event']),
    proof_url:    z.string().url().optional().or(z.literal('')),
    notes:        z.string().max(2000).optional(),
    submitted_by: z.string().max(200).optional(),
  })),
  (req, res) => {
    try {
      const { task_id, proof_type, proof_url, notes, submitted_by } = req.validated;
      const task = (store.tasks ?? []).find((t) => t.id === task_id);
      if (!task) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');

      task.proof_status       = 'submitted';
      task.proof_type         = proof_type;
      task.proof_url          = proof_url ?? null;
      task.proof_notes        = notes ?? '';
      task.proof_submitted_at = nowIso();
      task.proof_submitted_by = submitted_by ?? 'user';

      res.json({ task_id, proof_status: 'submitted', submitted_at: task.proof_submitted_at });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to submit proof');
    }
  },
];

export const approveAndSend = [
  validate(z.object({
    artifact_id:   z.string().min(1),
    approved_by:   z.string().min(1),
    export_type:   z.string().min(1),
    destination:   z.string().optional(),
    approval_note: z.string().max(1000).optional(),
  })),
  (req, res) => {
    try {
      const { artifact_id, approved_by, export_type, destination, approval_note } = req.validated;

      ArtifactStore.setApprovalStatus(artifact_id, 'approved', {
        reviewedBy:  approved_by,
        reviewNote:  approval_note ?? 'Approved via quick action',
        requestedBy: approved_by,
      });

      const exportResult = ExportService.queueExport({
        artifactId:    artifact_id,
        exportType:    export_type,
        requestedBy:   approved_by,
        destination:   destination ?? null,
        exportOptions: { quick_action: true },
      });

      if (!exportResult.eligible) {
        return errorResponse(res, 422, 'EXPORT_NOT_ELIGIBLE', exportResult.reason ?? 'Export not eligible', { detail: exportResult.detail });
      }

      ExportService.markReady(exportResult.export.export_id, { by: approved_by });
      ExportService.markExported(exportResult.export.export_id, { by: approved_by, destination });

      res.json({
        artifact_id,
        approved:      true,
        export_id:     exportResult.export.export_id,
        export_status: 'exported',
        warnings:      exportResult.warnings,
      });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to approve and send artifact');
    }
  },
];

// ─── Exports ──────────────────────────────────────────────────────────────────

export function listExports(req, res) {
  try {
    const filters = {};
    if (req.query.status)      filters.status    = req.query.status;
    if (req.query.export_type) filters.exportType = req.query.export_type;
    if (req.query.stale_only)  filters.staleOnly  = req.query.stale_only === 'true';
    res.json({ exports: ExportService.query(filters) });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve exports');
  }
}

export function getExport(req, res) {
  const record = ExportService.getById(req.params.id);
  if (!record) return errorResponse(res, 404, 'NOT_FOUND', 'Export not found');
  res.json(record);
}

export function getExportAudit(req, res) {
  const trail = ExportService.getAuditTrail(req.params.id);
  if (!trail) return errorResponse(res, 404, 'NOT_FOUND', 'Export not found');
  res.json(trail);
}

export const completeExport = [
  validate(z.object({
    by:          z.string().min(1),
    destination: z.string().optional(),
    note:        z.string().max(500).optional(),
  })),
  (req, res) => {
    try {
      const { by, destination, note } = req.validated;
      ExportService.markReady(req.params.id, { by });
      const record = ExportService.markExported(req.params.id, { by, note, destination });
      if (!record) return errorResponse(res, 404, 'NOT_FOUND', 'Export not found');
      res.json({ export_id: record.export_id, status: record.status, completed_at: record.completed_at });
    } catch (err) {
      if (err.message?.includes('invalid transition')) {
        return errorResponse(res, 409, 'INVALID_TRANSITION', err.message);
      }
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to complete export');
    }
  },
];

export const cancelExport = [
  validate(z.object({
    by:     z.string().min(1),
    reason: z.string().max(500).optional(),
  })),
  (req, res) => {
    try {
      const record = ExportService.cancelExport(req.params.id, { by: req.validated.by, reason: req.validated.reason });
      if (!record) return errorResponse(res, 404, 'NOT_FOUND', 'Export not found');
      res.json({ export_id: record.export_id, status: record.status });
    } catch (err) {
      if (err.message?.includes('invalid transition')) {
        return errorResponse(res, 409, 'INVALID_TRANSITION', err.message);
      }
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to cancel export');
    }
  },
];
