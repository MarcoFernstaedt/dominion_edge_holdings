/**
 * diligence.controller.js
 *
 * REST handlers for the diligence ingestion pipeline.
 * Routes: /api/diligence/:dealId/…
 */

import prisma from '../lib/prisma.js';
import {
  linkDocument,
  processDocument,
  synthesizeDeal,
  DOCUMENT_TYPES,
} from '../../services/DiligenceIngestionService.js';
import pino from 'pino';

const logger = pino({ name: 'diligence.controller' });

// ─── Documents ────────────────────────────────────────────────────────────────

/**
 * GET /api/diligence/:dealId/documents
 */
export async function listDocuments(req, res) {
  const { dealId } = req.params;

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const documents = await prisma.diligenceDocument.findMany({
    where:   { dealId },
    orderBy: { createdAt: 'desc' },
    include: {
      findings: {
        select: { id: true, severity: true, status: true, category: true, title: true },
        orderBy: { severity: 'asc' },
      },
    },
  });

  res.json({ documents, total: documents.length });
}

/**
 * POST /api/diligence/:dealId/documents
 * Body: { fileId, documentType, displayName }
 *
 * Links a StoredFile and triggers background processing immediately.
 */
export async function linkDocumentHandler(req, res) {
  const { dealId } = req.params;
  const { fileId, documentType, displayName } = req.body;

  if (!fileId) return res.status(400).json({ error: 'fileId is required' });

  let doc;
  try {
    doc = await linkDocument(dealId, fileId, documentType, displayName);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Respond immediately; ingestion runs in background
  res.status(202).json({ status: 'processing', doc });

  // Background ingestion — errors are logged only
  processDocument(doc.id).catch((err) =>
    logger.error({ docId: doc.id, err: err.message }, 'Background document processing failed'),
  );
}

/**
 * GET /api/diligence/:dealId/documents/:docId
 */
export async function getDocument(req, res) {
  const { dealId, docId } = req.params;

  const doc = await prisma.diligenceDocument.findUnique({
    where:   { id: docId },
    include: {
      findings: { orderBy: [{ severity: 'asc' }, { category: 'asc' }] },
    },
  });

  if (!doc || doc.dealId !== dealId) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json({ doc });
}

/**
 * POST /api/diligence/:dealId/documents/:docId/reprocess
 */
export async function reprocessDocument(req, res) {
  const { dealId, docId } = req.params;

  const doc = await prisma.diligenceDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.dealId !== dealId) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.status(202).json({ status: 'processing', docId });

  processDocument(docId).catch((err) =>
    logger.error({ docId, err: err.message }, 'Reprocessing failed'),
  );
}

// ─── Findings ─────────────────────────────────────────────────────────────────

/**
 * GET /api/diligence/:dealId/findings
 * Query: status, severity, category
 */
export async function listFindings(req, res) {
  const { dealId } = req.params;
  const { status, severity, category } = req.query;

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const where = { dealId };
  if (status)   where.status   = status;
  if (severity) where.severity = severity;
  if (category) where.category = category;

  const findings = await prisma.diligenceFinding.findMany({
    where,
    orderBy: [{ severity: 'asc' }, { category: 'asc' }, { createdAt: 'desc' }],
    include: { document: { select: { id: true, displayName: true, documentType: true } } },
  });

  res.json({ findings, total: findings.length });
}

/**
 * PATCH /api/diligence/:dealId/findings/:id
 * Body: { status, resolutionNotes }
 */
export async function updateFinding(req, res) {
  const { dealId, id } = req.params;
  const { status, resolutionNotes } = req.body;

  const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'waived'];
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const finding = await prisma.diligenceFinding.findUnique({ where: { id } });
  if (!finding || finding.dealId !== dealId) {
    return res.status(404).json({ error: 'Finding not found' });
  }

  const updateData = {};
  if (status) {
    updateData.status = status;
    if (status === 'resolved' || status === 'waived') {
      updateData.resolvedAt  = new Date();
      updateData.resolvedBy  = req.user?.id ?? null;
    }
  }
  if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;

  const updated = await prisma.diligenceFinding.update({ where: { id }, data: updateData });
  res.json({ finding: updated });
}

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * GET /api/diligence/:dealId/summary
 * Returns existing summary or a stub if none.
 */
export async function getSummary(req, res) {
  const { dealId } = req.params;

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const summary = await prisma.diligenceSummary.findUnique({ where: { dealId } });

  if (!summary) {
    return res.json({
      summary: {
        dealId,
        readinessState: 'not_started',
        readinessScore: 0,
        synthesisVersion: 0,
        executiveSummary: null,
        topRisks: [],
        missingItems: [],
        sellerQuestions: [],
        brokerQuestions: [],
        lenderQuestions: [],
        attorneyQuestions: [],
      },
    });
  }

  res.json({ summary });
}

/**
 * POST /api/diligence/:dealId/summary/synthesize
 * Triggers AI synthesis (synchronous — client waits).
 */
export async function synthesize(req, res) {
  const { dealId } = req.params;

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  try {
    const summary = await synthesizeDeal(dealId);
    res.json({ summary });
  } catch (err) {
    logger.error({ dealId, err: err.message }, 'Synthesis failed');
    res.status(500).json({ error: `Synthesis failed: ${err.message}` });
  }
}

/**
 * GET /api/diligence/:dealId/questions
 * Returns all stakeholder questions grouped by type.
 */
export async function getQuestions(req, res) {
  const { dealId } = req.params;

  const summary = await prisma.diligenceSummary.findUnique({
    where:  { dealId },
    select: { sellerQuestions: true, brokerQuestions: true, lenderQuestions: true, attorneyQuestions: true },
  });

  res.json({
    questions: {
      seller:   summary?.sellerQuestions   ?? [],
      broker:   summary?.brokerQuestions   ?? [],
      lender:   summary?.lenderQuestions   ?? [],
      attorney: summary?.attorneyQuestions ?? [],
    },
  });
}

/**
 * GET /api/diligence/document-types
 * Returns the list of valid document types (for frontend dropdowns).
 */
export async function getDocumentTypes(req, res) {
  res.json({ documentTypes: DOCUMENT_TYPES });
}
