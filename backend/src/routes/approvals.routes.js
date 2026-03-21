import express       from 'express';
import { z }         from 'zod';
import ApprovalService from '../../services/ApprovalService.js';
import * as ArtifactStore from '../../services/ArtifactStore.js';
import ExportService  from '../../services/ExportService.js';
import ModelGateway   from '../../services/ModelGateway.js';
import { validate }   from '../middleware/validate.js';
import { errorResponse } from '../middleware/errorResponse.js';
import { nowIso }     from '../lib/helpers.js';

const router = express.Router();

// ─── Approval routes ──────────────────────────────────────────────────────────

router.get('/api/approvals', (req, res) => {
  const { status, artifactType, actionType, approvalScope, entityId, recipientType, limit, offset } = req.query;
  try {
    res.json(ApprovalService.query({
      status, artifactType, actionType, approvalScope, entityId, recipientType,
      limit:  Math.min(Number(limit) || 50, 200),
      offset: Number(offset) || 0,
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/approvals/:id', (req, res) => {
  const rec = ApprovalService.getById(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Approval not found' });
  res.json(rec);
});

router.get('/api/approvals/:id/history', (req, res) => {
  try {
    res.json(ApprovalService.getHistory(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/api/approvals/:id/staleness', (req, res) => {
  try {
    const warning = ApprovalService.getStalenessWarning(req.params.id);
    res.json({ stale: Boolean(warning), warning });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/api/approvals/:id/submit', (req, res) => {
  try {
    const rec = ApprovalService.submit(req.params.id, { submittedBy: req.body?.submitted_by ?? 'user' });
    res.json(rec);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/api/approvals/:id/approve', validate(z.object({ notes: z.string().max(500).optional() })), (req, res) => {
  try {
    const rec = ApprovalService.approve(req.params.id, { notes: req.validated.notes });
    res.json(rec);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/api/approvals/:id/reject', validate(z.object({ reason: z.string().min(1).max(500) })), (req, res) => {
  try {
    const rec = ApprovalService.reject(req.params.id, { reason: req.validated.reason });
    res.json(rec);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/api/approvals/:id/revise', validate(z.object({ instructions: z.string().min(1).max(1000) })), (req, res) => {
  try {
    const rec = ApprovalService.requestRevision(req.params.id, { instructions: req.validated.instructions });
    res.json(rec);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/api/approvals/:id/apply', (req, res) => {
  try {
    const rec = ApprovalService.apply(req.params.id, { appliedBy: req.body?.applied_by ?? 'user' });
    res.json(rec);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Artifact routes ──────────────────────────────────────────────────────────

router.get('/api/artifacts', (req, res) => {
  const { artifactType, artifactStatus, approvalStatus, linkedEntityId, generatedByAgent, approvalRequired, latestOnly, limit, offset } = req.query;
  try {
    const result = ArtifactStore.query({
      artifactType:     artifactType ?? req.query.type,
      artifactStatus,
      approvalStatus,
      linkedEntityId,
      generatedByAgent,
      approvalRequired: approvalRequired !== undefined ? approvalRequired === 'true' : null,
      latestOnly:       latestOnly !== 'false',
      limit:            Math.min(Number(limit) || 50, 200),
      offset:           Number(offset) || 0,
    });
    if (Array.isArray(result)) {
      res.json({ artifacts: result, total: result.length });
    } else if (result && Array.isArray(result.artifacts)) {
      res.json(result);
    } else {
      const items = result?.items ?? result?.results ?? [];
      res.json({ artifacts: items, total: items.length });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/artifacts', validate(z.object({
  type:              z.string().min(1).optional(),
  artifactType:      z.string().min(1).optional(),
  title:             z.string().min(1).max(300),
  linkedEntityTypes: z.array(z.string()).optional().default([]),
  linkedEntityIds:   z.array(z.string()).optional().default([]),
  content:           z.any(),
  format:            z.enum(['json', 'markdown', 'text']).optional().default('json'),
  generatedByAgent:  z.string().optional(),
  promptKey:         z.string().optional(),
  promptVersion:     z.string().optional(),
  approvalRequired:  z.boolean().optional().default(false),
  groupId:           z.string().optional(),
  staleHours:        z.number().optional(),
}).refine((d) => d.type || d.artifactType, { message: 'type is required', path: ['type'] })), (req, res) => {
  try {
    const data = req.validated;
    const artifact = ArtifactStore.create({ ...data, artifactType: data.artifactType ?? data.type });
    const normalised = { ...artifact };
    if (!normalised.artifactId && normalised.id) normalised.artifactId = normalised.id;
    res.status(201).json({ artifact: normalised });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/api/artifacts/:id', (req, res) => {
  const art = ArtifactStore.getById(req.params.id);
  if (!art) return res.status(404).json({ error: 'Artifact not found' });
  res.json(art);
});

router.get('/api/artifacts/:id/summary', (req, res) => {
  try {
    res.json(ArtifactStore.getSummary(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/api/artifacts/:id/versions', (req, res) => {
  try {
    const art = ArtifactStore.getById(req.params.id);
    if (!art) return res.status(404).json({ error: 'Artifact not found' });
    res.json(ArtifactStore.getVersionHistory(art.groupId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/api/artifacts/:id/staleness', (req, res) => {
  try {
    res.json(ArtifactStore.getStaleness(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/api/artifacts/:id/mark-sent', (req, res) => {
  try {
    const art = ArtifactStore.markSent(req.params.id, { sentBy: req.body?.sent_by ?? 'user' });
    res.json(art);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/api/artifacts/generate', validate(z.object({
  artifact_type:     z.string().min(1),
  entity_ids:        z.array(z.string()).optional(),
  context:           z.record(z.unknown()).optional(),
  requested_by:      z.string().max(200).optional(),
  format:            z.string().optional(),
  approval_required: z.boolean().optional(),
})), async (req, res) => {
  try {
    const { artifact_type, entity_ids = [], context = {}, requested_by, format, approval_required } = req.validated;
    const artifact = ArtifactStore.create({
      type:              artifact_type,
      title:             `Generated ${artifact_type}`,
      content:           '',
      generatedBySystem: true,
      createdBy:         requested_by ?? 'system',
      format:            format ?? 'markdown',
      entity_ids,
      approvalRequired:  approval_required,
      metadata:          { context, generation_requested_at: nowIso() },
    });

    try {
      const result = await ModelGateway.run({
        taskType:     artifact_type,
        agentName:    'ArtifactGeneratorAgent',
        entityIds:    entity_ids,
        systemPrompt: `You are a document generation assistant for a private equity acquisition firm. Generate a ${artifact_type} document. Return structured content appropriate for the document type.`,
        userMessage:  JSON.stringify({ artifact_type, context }),
      });
      ArtifactStore.update(artifact.id, {
        content:       result.content,
        provider_used: result.provider_used,
        model_used:    result.model_used,
        generated_at:  nowIso(),
      });
    } catch (aiErr) {
      console.warn('[artifacts/generate] AI generation failed', aiErr.message);
    }

    res.status(201).json({ artifact: ArtifactStore.getSummary(artifact.id) });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate artifact');
  }
});

router.post('/api/artifacts/:id/regenerate', async (req, res) => {
  try {
    const existing = ArtifactStore.getById(req.params.id);
    if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Artifact not found');
    if (existing.status === 'archived') return errorResponse(res, 409, 'ARCHIVED', 'Cannot regenerate an archived artifact');

    const newVersion = ArtifactStore.create({
      type:              existing.artifactType,
      title:             existing.title,
      content:           '',
      generatedBySystem: true,
      createdBy:         req.body?.requested_by ?? 'system',
      format:            existing.format ?? 'markdown',
      groupId:           existing.groupId,
      metadata:          { ...existing.metadata, regenerated_from: existing.id, regenerated_at: nowIso() },
      approvalRequired:  existing.approvalRequired,
    });

    try {
      const result = await ModelGateway.run({
        taskType:     existing.artifactType,
        agentName:    'ArtifactGeneratorAgent',
        entityIds:    existing.entityIds ?? [],
        systemPrompt: `You are a document generation assistant. Regenerate the following document type with fresh content: ${existing.artifactType}`,
        userMessage:  JSON.stringify({ artifact_type: existing.artifactType, context: existing.metadata?.context ?? {}, revision_notes: req.body?.revision_notes ?? '' }),
      });
      ArtifactStore.update(newVersion.id, {
        content:       result.content,
        provider_used: result.provider_used,
        model_used:    result.model_used,
        generated_at:  nowIso(),
      });
    } catch (aiErr) {
      console.warn('[artifacts/regenerate] AI failed', aiErr.message);
    }

    res.status(201).json({ artifact: ArtifactStore.getSummary(newVersion.id), previous_version_id: existing.id });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to regenerate artifact');
  }
});

router.post('/api/artifacts/:id/archive', validate(z.object({
  by:     z.string().min(1),
  reason: z.string().max(500).optional(),
})), (req, res) => {
  try {
    const artifact = ArtifactStore.getById(req.params.id);
    if (!artifact) return errorResponse(res, 404, 'NOT_FOUND', 'Artifact not found');
    ArtifactStore.archive(req.params.id, { by: req.validated.by, reason: req.validated.reason });
    res.json({ id: req.params.id, status: 'archived' });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to archive artifact');
  }
});

router.post('/api/artifacts/:id/export', validate(z.object({
  export_type:    z.string().min(1),
  requested_by:   z.string().min(1),
  destination:    z.string().optional(),
  export_options: z.record(z.unknown()).optional(),
})), (req, res) => {
  try {
    const { export_type, requested_by, destination, export_options } = req.validated;
    const result = ExportService.queueExport({
      artifactId:    req.params.id,
      exportType:    export_type,
      requestedBy:   requested_by,
      destination:   destination ?? null,
      exportOptions: export_options ?? {},
    });

    if (!result.eligible) {
      return errorResponse(res, 422, 'EXPORT_NOT_ELIGIBLE', result.reason ?? 'Export not eligible', { detail: result.detail, warnings: result.warnings });
    }

    res.status(202).json({
      export_id:   result.export.export_id,
      status:      result.export.status,
      warnings:    result.warnings,
      artifact_id: req.params.id,
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to queue artifact export');
  }
});

export default router;
