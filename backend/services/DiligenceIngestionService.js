/**
 * DiligenceIngestionService
 *
 * Orchestrates the full diligence document pipeline:
 *   1. Link an uploaded StoredFile to a deal as a DiligenceDocument
 *   2. Fetch file content from S3
 *   3. Classify document type (if unknown)
 *   4. Extract structured fields (revenue, SDE, debt, customers, etc.)
 *   5. Extract red-flag findings (category, severity, confidence, source, follow-up)
 *   6. Auto-create tasks for fatal/critical findings
 *   7. Synthesize cross-document executive summary + stakeholder questions
 *
 * Rules (enforced throughout):
 *   - AI may classify, extract, and flag — never invent facts
 *   - Every finding retains documentId for source traceability
 *   - Fatal/critical findings are deterministically blocker-flagged (not AI-derived)
 *   - Malformed AI responses are logged and skipped; processing continues
 */

import prisma from '../src/lib/prisma.js';
import { run, runWithDocument } from './AIService.js';
import { S3StorageProvider }    from './providers/S3StorageProvider.js';
import {
  DILIGENCE_CATEGORIES,
  SEVERITY_LEVELS,
  overallCompleteness,
} from './DiligenceEngine.js';
import pino from 'pino';

const logger = pino({ name: 'DiligenceIngestionService' });

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const DOCUMENT_TYPES = [
  'cim',
  'financial_statements',
  'contract',
  'lease',
  'tax_return',
  'checklist',
  'broker_notes',
  'seller_notes',
  'other',
];

const TEXT_MIME_PREFIXES = ['text/', 'application/csv', 'application/json', 'application/xml'];
const PDF_MIME = 'application/pdf';

// ─── Public: linkDocument ─────────────────────────────────────────────────────

/**
 * Link a StoredFile (already uploaded to S3) to a deal as a DiligenceDocument.
 * Returns the new DiligenceDocument record. Throws if fileId already linked.
 *
 * @param {string} dealId
 * @param {string} fileId        — StoredFile.id
 * @param {string} documentType  — one of DOCUMENT_TYPES (default: 'other')
 * @param {string} displayName   — human label; falls back to originalName
 * @returns {Promise<object>}    DiligenceDocument
 */
export async function linkDocument(dealId, fileId, documentType = 'other', displayName = '') {
  // Validate
  const [deal, storedFile, existing] = await Promise.all([
    prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } }),
    prisma.storedFile.findUnique({ where: { id: fileId } }),
    prisma.diligenceDocument.findUnique({ where: { fileId } }),
  ]);

  if (!deal)       throw new Error(`Deal ${dealId} not found`);
  if (!storedFile) throw new Error(`StoredFile ${fileId} not found`);
  if (existing)    throw new Error(`File ${fileId} is already linked to diligence document ${existing.id}`);

  const resolvedType = DOCUMENT_TYPES.includes(documentType) ? documentType : 'other';
  const resolvedName = displayName.trim() || storedFile.originalName || 'Untitled';

  const doc = await prisma.diligenceDocument.create({
    data: {
      dealId,
      fileId,
      documentType:    resolvedType,
      displayName:     resolvedName,
      ingestionStatus: 'pending',
    },
  });

  logger.info({ dealId, docId: doc.id, fileId, documentType: resolvedType }, 'DiligenceDocument linked');
  return doc;
}

// ─── Public: processDocument ──────────────────────────────────────────────────

/**
 * Run the full ingestion pipeline for a DiligenceDocument.
 * Safe to call multiple times — re-processes the document.
 *
 * @param {string} diligenceDocId
 * @returns {Promise<{ doc: object, findings: object[] }>}
 */
export async function processDocument(diligenceDocId) {
  const doc = await prisma.diligenceDocument.findUnique({
    where: { id: diligenceDocId },
    include: { deal: { select: { id: true } } },
  });
  if (!doc) throw new Error(`DiligenceDocument ${diligenceDocId} not found`);

  const storedFile = await prisma.storedFile.findUnique({ where: { id: doc.fileId } });
  if (!storedFile) throw new Error(`StoredFile ${doc.fileId} not found`);

  // Mark processing
  await prisma.diligenceDocument.update({
    where: { id: diligenceDocId },
    data:  { ingestionStatus: 'processing', processingError: null },
  });

  try {
    // 1. Fetch content
    const { buffer, isText, textContent } = await _fetchContent(storedFile);

    // 2. Classify if still 'other'
    const updatedDoc = doc.documentType === 'other'
      ? await _classifyDocument(doc, storedFile, textContent)
      : doc;

    // 3. Extract structured fields
    const extractedFields = await _extractFields(updatedDoc, buffer, textContent, storedFile);

    // 4. Extract red-flag findings
    const rawFindings = await _extractFindings(updatedDoc, extractedFields, buffer, textContent, storedFile);

    // 5. Persist findings (delete stale AI findings first)
    await prisma.diligenceFinding.deleteMany({
      where: { documentId: diligenceDocId, aiGenerated: true },
    });

    const findings = [];
    for (const f of rawFindings) {
      try {
        const created = await prisma.diligenceFinding.create({
          data: {
            dealId:             doc.dealId,
            documentId:         diligenceDocId,
            category:           f.category,
            severity:           f.severity,
            confidence:         f.confidence,
            title:              f.title,
            sourceSnippet:      f.sourceSnippet ?? null,
            whyItMatters:       f.whyItMatters,
            recommendedFollowUp: f.recommendedFollowUp,
            status:             'open',
            aiGenerated:        true,
          },
        });
        findings.push(created);
      } catch (err) {
        logger.warn({ err: err.message, finding: f }, 'Failed to persist finding — skipped');
      }
    }

    // 6. Auto-create tasks for fatal/critical findings
    await _autoCreateTasks(doc.dealId, findings);

    // 7. Mark done
    const wordCount   = textContent ? textContent.split(/\s+/).length : null;
    const textPreview = textContent ? textContent.slice(0, 600) : null;

    const finalDoc = await prisma.diligenceDocument.update({
      where: { id: diligenceDocId },
      data: {
        ingestionStatus: 'done',
        processedAt:     new Date(),
        extractedFields,
        textPreview,
        wordCount,
      },
    });

    logger.info(
      { docId: diligenceDocId, findingCount: findings.length, wordCount },
      'DiligenceDocument processing complete',
    );
    return { doc: finalDoc, findings };

  } catch (err) {
    logger.error({ docId: diligenceDocId, err: err.message }, 'DiligenceDocument processing failed');
    await prisma.diligenceDocument.update({
      where: { id: diligenceDocId },
      data: {
        ingestionStatus: 'failed',
        processingError: err.message,
      },
    });
    throw err;
  }
}

// ─── Public: synthesizeDeal ───────────────────────────────────────────────────

/**
 * Aggregate all findings across a deal's documents and produce:
 * - Executive summary
 * - Top risks
 * - Missing items
 * - Stakeholder questions (seller, broker, lender, attorney)
 * - Readiness score
 *
 * Safe to call multiple times — upserts DiligenceSummary.
 *
 * @param {string} dealId
 * @returns {Promise<object>}  DiligenceSummary
 */
export async function synthesizeDeal(dealId) {
  const [deal, documents, findings] = await Promise.all([
    prisma.deal.findUnique({ where: { id: dealId }, select: { id: true, name: true } }),
    prisma.diligenceDocument.findMany({ where: { dealId }, orderBy: { createdAt: 'asc' } }),
    prisma.diligenceFinding.findMany({ where: { dealId }, orderBy: [{ severity: 'asc' }, { category: 'asc' }] }),
  ]);

  if (!deal) throw new Error(`Deal ${dealId} not found`);

  // Build context for AI
  const docSummary = documents.map((d) =>
    `- ${d.displayName} (${d.documentType}): ${d.ingestionStatus}` +
    (d.wordCount ? `, ${d.wordCount} words` : ''),
  ).join('\n');

  const findingSummary = findings.map((f) =>
    `[${f.severity.toUpperCase()}] ${f.category} | ${f.title}\n` +
    `  Why it matters: ${f.whyItMatters}\n` +
    `  Follow-up: ${f.recommendedFollowUp}` +
    (f.sourceSnippet ? `\n  Source: "${f.sourceSnippet.slice(0, 150)}"` : ''),
  ).join('\n\n');

  const aggregatedContext =
    `DEAL: ${deal.name}\n\n` +
    `DOCUMENTS REVIEWED (${documents.length}):\n${docSummary || 'None'}\n\n` +
    `FINDINGS (${findings.length} total):\n${findingSummary || 'No findings yet.'}`;

  const systemPrompt = `You are a senior M&A diligence analyst for a search fund acquisition.
Based on the documents reviewed and findings identified, produce a structured diligence summary.
Return ONLY valid JSON. Do not invent facts not present in the findings.
If there is insufficient data, say so honestly in the summary.
Required JSON structure:
{
  "executiveSummary": "2-4 sentence deal status summary",
  "topRisks": [{ "risk": "string", "severity": "fatal|critical|high|medium|low" }],
  "missingItems": [{ "category": "string", "item": "string", "priority": "high|medium|low" }],
  "sellerQuestions": ["string"],
  "brokerQuestions": ["string"],
  "lenderQuestions": ["string"],
  "attorneyQuestions": ["string"]
}`;

  let aiResult = {
    executiveSummary:  null,
    topRisks:          [],
    missingItems:      [],
    sellerQuestions:   [],
    brokerQuestions:   [],
    lenderQuestions:   [],
    attorneyQuestions: [],
  };

  try {
    const response = await run('diligence_summary_synthesis', {}, {
      systemPrompt,
      userMessage: aggregatedContext,
      maxTokens:   3000,
      agentName:   'diligence_synthesis',
      entityId:    dealId,
      entityType:  'deal',
      skipCache:   true,
    });
    const parsed = typeof response.content === 'string'
      ? JSON.parse(response.content)
      : response.content;
    aiResult = { ...aiResult, ...parsed };
  } catch (err) {
    logger.warn({ dealId, err: err.message }, 'AI synthesis failed — saving partial summary');
    aiResult.executiveSummary = `Synthesis incomplete: ${err.message}`;
  }

  // Readiness score — map findings to DiligenceEngine issue format
  const issueFormat = findings.map((f) => ({
    category: f.category,
    severity: f.severity,
    status:   f.status,
    owner_id: null,
    is_lender_blocker: f.severity === 'fatal' || f.severity === 'critical',
    is_close_blocker:  f.severity === 'fatal',
  }));

  const completeness = overallCompleteness(issueFormat, []);
  const score        = completeness.overall_score;
  const state        =
    score >= 85 ? 'ready'
    : score >= 70 ? 'advanced'
    : score >= 50 ? 'in_progress'
    : score >= 30 ? 'early'
    : 'not_started';

  // Upsert
  const existing = await prisma.diligenceSummary.findUnique({ where: { dealId } });
  const summary = await prisma.diligenceSummary.upsert({
    where:  { dealId },
    create: {
      dealId,
      ...aiResult,
      readinessScore:   score,
      readinessState:   state,
      lastSynthesizedAt: new Date(),
      synthesisVersion: 1,
    },
    update: {
      ...aiResult,
      readinessScore:   score,
      readinessState:   state,
      lastSynthesizedAt: new Date(),
      synthesisVersion: (existing?.synthesisVersion ?? 0) + 1,
    },
  });

  logger.info({ dealId, score, state, findingCount: findings.length }, 'DiligenceSummary synthesized');
  return summary;
}

// ─── Private: _fetchContent ───────────────────────────────────────────────────

async function _fetchContent(storedFile) {
  if (storedFile.sizeBytes && storedFile.sizeBytes > MAX_FILE_BYTES) {
    throw new Error(
      `File too large for ingestion: ${Math.round(storedFile.sizeBytes / 1024 / 1024)} MB` +
      ` (max ${MAX_FILE_BYTES / 1024 / 1024} MB)`,
    );
  }

  const guard = { ok: S3StorageProvider.isConfigured() };
  if (!guard.ok) {
    throw new Error('Storage not configured — cannot read file content for ingestion');
  }

  const buffer  = await S3StorageProvider.getObjectBuffer(storedFile.key);
  const mime    = storedFile.mimeType ?? '';

  const isText = TEXT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
  const isPdf  = mime === PDF_MIME;

  let textContent = null;
  if (isText) {
    textContent = buffer.toString('utf-8');
  } else if (!isPdf) {
    // Best-effort UTF-8 decode for docx, xlsx, etc. — may be noisy but workable for short docs
    try { textContent = buffer.toString('utf-8'); } catch { /* ignore */ }
  }

  return { buffer, isText, isPdf, textContent };
}

// ─── Private: _classifyDocument ──────────────────────────────────────────────

async function _classifyDocument(doc, storedFile, textContent) {
  const preview = textContent ? textContent.slice(0, 1200) : '';
  const systemPrompt =
    `Classify this document into one of: ${DOCUMENT_TYPES.join(', ')}.` +
    ` Return ONLY valid JSON: { "documentType": "<type>" }. Use "other" if unsure.`;

  const userMessage =
    `File name: ${storedFile.originalName}\nContent preview:\n${preview}`;

  let documentType = 'other';
  try {
    const response = await run('diligence_doc_classify', {}, {
      systemPrompt,
      userMessage,
      maxTokens: 64,
      agentName: 'diligence_ingestion',
      entityId:  doc.id,
    });
    const parsed = typeof response.content === 'string'
      ? JSON.parse(response.content)
      : response.content;
    if (parsed.documentType && DOCUMENT_TYPES.includes(parsed.documentType)) {
      documentType = parsed.documentType;
    }
  } catch (err) {
    logger.warn({ docId: doc.id, err: err.message }, 'Document classification failed — using "other"');
  }

  const updated = await prisma.diligenceDocument.update({
    where: { id: doc.id },
    data:  { documentType },
  });
  return updated;
}

// ─── Private: _extractFields ──────────────────────────────────────────────────

async function _extractFields(doc, buffer, textContent, storedFile) {
  const systemPrompt = `You are a diligence analyst. Extract structured financial and operational facts.
Return ONLY valid JSON. Do not invent data not present in the document.
Set any field to null if not found. Required fields:
{
  "revenue_ttm": number|null,
  "revenue_prior_year": number|null,
  "sde_claimed": number|null,
  "ebitda_claimed": number|null,
  "gross_margin_pct": number|null,
  "customer_count": number|null,
  "top_customer_pct_revenue": number|null,
  "employee_count": number|null,
  "owner_comp_total": number|null,
  "debt_outstanding": number|null,
  "lease_term_years": number|null,
  "lease_monthly_cost": number|null,
  "business_age_years": number|null,
  "license_types": string[]|null,
  "key_dependencies": string[]|null,
  "working_capital_note": string|null,
  "document_date": string|null,
  "business_description": string|null
}`;

  try {
    const mime  = storedFile.mimeType ?? '';
    const isPdf = mime === PDF_MIME;
    const text  = textContent ? textContent.slice(0, 12000) : '';

    let response;
    if (isPdf && buffer.length > 0) {
      response = await runWithDocument('diligence_extract_fields', buffer, {
        systemPrompt,
        userMessage: 'Extract the structured fields from this document.',
        maxTokens:   2048,
        agentName:   'diligence_ingestion',
      });
    } else {
      response = await run('diligence_extract_fields', {}, {
        systemPrompt,
        userMessage: text || `File: ${storedFile.originalName}`,
        maxTokens:   2048,
        agentName:   'diligence_ingestion',
        entityId:    doc.id,
        skipCache:   true,
      });
    }

    const parsed = typeof response.content === 'string'
      ? JSON.parse(response.content)
      : response.content;
    return parsed;
  } catch (err) {
    logger.warn({ docId: doc.id, err: err.message }, 'Field extraction failed — storing raw');
    return { raw_extraction_error: err.message };
  }
}

// ─── Private: _extractFindings ────────────────────────────────────────────────

async function _extractFindings(doc, extractedFields, buffer, textContent, storedFile) {
  const fieldsJson  = JSON.stringify(extractedFields ?? {}, null, 2);
  const textExcerpt = textContent ? textContent.slice(0, 8000) : '';
  const mime        = storedFile.mimeType ?? '';
  const isPdf       = mime === PDF_MIME;

  const systemPrompt = `You are a diligence red-flag analyst for a search fund acquisition.
Identify red flags in this document. Return a JSON array of findings.
Each finding MUST have:
{
  "category": "${DILIGENCE_CATEGORIES.join('|')}",
  "severity": "${SEVERITY_LEVELS.join('|')}",
  "confidence": "high|medium|low",
  "title": "≤12 words",
  "sourceSnippet": "verbatim quote ≤200 chars or null",
  "whyItMatters": "1-2 sentences",
  "recommendedFollowUp": "specific question or action"
}
Flag ONLY things actually present in the document. Do not invent findings.
Return empty array [] if no red flags found.`;

  const userMessage =
    `EXTRACTED FIELDS:\n${fieldsJson}\n\n` +
    (textExcerpt ? `DOCUMENT TEXT (excerpt):\n${textExcerpt}` : '');

  let rawFindings = [];
  try {
    let response;
    if (isPdf && buffer.length > 0) {
      response = await runWithDocument('diligence_flag_extraction', buffer, {
        systemPrompt,
        userMessage: userMessage + '\n\nIdentify all red flags in this document.',
        maxTokens:   4096,
        agentName:   'diligence_ingestion',
      });
    } else {
      response = await run('diligence_flag_extraction', {}, {
        systemPrompt,
        userMessage,
        maxTokens:   4096,
        agentName:   'diligence_ingestion',
        entityId:    doc.id,
        skipCache:   true,
      });
    }

    const parsed = typeof response.content === 'string'
      ? JSON.parse(response.content)
      : response.content;

    rawFindings = Array.isArray(parsed) ? parsed : (parsed.findings ?? []);
  } catch (err) {
    logger.warn({ docId: doc.id, err: err.message }, 'Finding extraction failed — no findings stored');
    return [];
  }

  // Validate each finding — discard malformed
  const validated = [];
  for (const f of rawFindings) {
    if (!f || typeof f !== 'object')                       continue;
    if (!DILIGENCE_CATEGORIES.includes(f.category))       continue;
    if (!SEVERITY_LEVELS.includes(f.severity))             continue;
    if (!['high', 'medium', 'low'].includes(f.confidence)) continue;
    if (!f.title || typeof f.title !== 'string')           continue;
    if (!f.whyItMatters || !f.recommendedFollowUp)        continue;
    validated.push({
      category:           f.category,
      severity:           f.severity,
      confidence:         f.confidence,
      title:              String(f.title).slice(0, 200),
      sourceSnippet:      f.sourceSnippet ? String(f.sourceSnippet).slice(0, 500) : null,
      whyItMatters:       String(f.whyItMatters),
      recommendedFollowUp: String(f.recommendedFollowUp),
    });
  }

  logger.info(
    { docId: doc.id, raw: rawFindings.length, validated: validated.length },
    'Findings extracted and validated',
  );
  return validated;
}

// ─── Private: _autoCreateTasks ────────────────────────────────────────────────

async function _autoCreateTasks(dealId, findings) {
  const actionable = findings.filter(
    (f) => (f.severity === 'fatal' || f.severity === 'critical') && f.status === 'open',
  );

  for (const finding of actionable) {
    try {
      await prisma.task.create({
        data: {
          title:            `[Diligence] ${finding.title}`,
          description:      `${finding.whyItMatters}\n\nRecommended: ${finding.recommendedFollowUp}`,
          status:           'todo',
          priority:         finding.severity === 'fatal' ? 'critical' : 'high',
          linkedEntityType: 'deal',
          linkedEntityId:   dealId,
          source:           'diligence_ingestion',
        },
      });
    } catch (err) {
      logger.warn({ dealId, findingId: finding.id, err: err.message }, 'Auto-task creation failed');
    }
  }
}

export default {
  linkDocument,
  processDocument,
  synthesizeDeal,
  DOCUMENT_TYPES,
};
