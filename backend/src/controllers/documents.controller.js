import store     from '../store.js';
import IntegrationRegistry from '../../services/IntegrationRegistry.js';
import { errorResponse }   from '../middleware/errorResponse.js';
import { uid, nowIso, findById, getSafeModel } from '../lib/helpers.js';
import { DEH_SYSTEM_PROMPT } from '../config/constants.js';
import { createAnthropicMessage } from '../lib/aiClient.js';

export function listDocuments(req, res) {
  try {
    const { entityId, documentType } = req.query;
    let results = [...store.documents];
    if (entityId && typeof entityId === 'string') results = results.filter((d) => d.entityId === entityId);
    if (documentType && typeof documentType === 'string') results = results.filter((d) => d.documentType === documentType);
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve documents');
  }
}

export function createDocument(req, res) {
  try {
    const doc = {
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: 'draft',
      version: 1,
      source: 'template',
      generatedBy: 'system',
      ...req.validated,
    };
    store.documents.push(doc);
    res.status(201).json(doc);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create document');
  }
}

export function getDocument(req, res) {
  try {
    const doc = findById(store.documents, req.params.id);
    if (!doc) return errorResponse(res, 404, 'NOT_FOUND', 'Document not found');
    res.json(doc);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve document');
  }
}

export function getReportSummary(_req, res) {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const allItems = store.checklistPhases.flatMap((p) => p.items || []);
    const completedItems = allItems.filter((i) => i.isComplete).length;

    res.json({
      overview: {
        progressPct: allItems.length > 0 ? Math.round((completedItems / allItems.length) * 100) : 0,
        completedItems,
        totalItems: allItems.length,
      },
      tasks: {
        total: store.tasks.length,
        open: store.tasks.filter((t) => t.status !== 'done' && t.status !== 'archived').length,
        completedThisWeek: store.tasks.filter((t) => t.status === 'done' && t.completedAt && new Date(t.completedAt) > weekAgo).length,
        overdue: store.tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < now).length,
      },
      crm: {
        companies: store.companies.length,
        companiesThisWeek: store.companies.filter((c) => new Date(c.createdAt) > weekAgo).length,
        contacts: store.contacts.length,
        interactions: store.interactions.length,
        outboundThisWeek: store.interactions.filter((i) => i.direction === 'outbound' && new Date(i.createdAt) > weekAgo).length,
        inboundThisWeek: store.interactions.filter((i) => i.direction === 'inbound' && new Date(i.createdAt) > weekAgo).length,
      },
      pipeline: {
        total: store.deals.length,
        active: store.deals.filter((d) => d.status === 'active').length,
        closed: store.deals.filter((d) => d.status === 'closed').length,
        stalled: store.deals.filter((d) => d.status === 'active' && (now.getTime() - new Date(d.updatedAt).getTime()) > 7 * 86400000).length,
      },
      board: {
        confirmed: store.boardCandidates.filter((c) => c.status === 'confirmed').length,
        pipeline: store.boardCandidates.filter((c) =>
          ['identified', 'researched', 'outreach_sent', 'meeting_scheduled', 'interested', 'negotiating'].includes(c.status)
        ).length,
        total: store.boardCandidates.length,
      },
      underwriting: {
        scenarios: store.underwritingScenarios.length,
        passingDSCR: store.underwritingScenarios.filter((s) => s.dscr >= 1.25).length,
        bestDSCR: store.underwritingScenarios.reduce((best, s) => Math.max(best, s.dscr || 0), 0),
      },
      documents: { total: store.documents.length },
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate report');
  }
}

export function getSettings(_req, res) {
  const { smtpPassword: _smtpPassword, ...safeSettings } = store.settings;
  res.json(safeSettings);
}

export function patchSettings(req, res) {
  try {
    const { smtpPassword: _smtpPassword, ...safeUpdates } = req.validated;
    store.settings = { ...store.settings, ...safeUpdates };
    IntegrationRegistry.syncFromSettings(store.settings);
    const { smtpPassword: _, ...safeSettings } = store.settings;
    res.json(safeSettings);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update settings');
  }
}

export async function aiReplySuggestion(req, res) {
  if (!store.settings.aiReplyEnabled) {
    return errorResponse(res, 403, 'FEATURE_DISABLED', 'AI reply suggestions are disabled in settings');
  }

  const { threadSubject, lastMessage, senderName, companyName } = req.validated;

  try {
    const message = await createAnthropicMessage({
      model: getSafeModel(store.settings),
      max_tokens: 512,
      system: DEH_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Suggest a brief reply.\nSender: ${senderName || 'Unknown'}\nCompany: ${companyName || 'Unknown'}\nSubject: ${threadSubject || ''}\nMessage: "${lastMessage}"\n\nReturn JSON only: {"subject": "Re: ...", "body": "..."}. Under 100 words.`,
      }],
    });

    const text = message.content[0]?.text ?? '';
    try {
      const match = text.match(/\{[\s\S]*\}/);
      const json = match ? JSON.parse(match[0]) : {};
      res.json({ subject: json.subject || `Re: ${threadSubject}`, body: json.body || text });
    } catch {
      res.json({ subject: `Re: ${threadSubject || ''}`, body: text });
    }
  } catch (err) {
    console.error('[ai/reply-suggestion]', err.message);
    errorResponse(res, 503, 'AI_UNAVAILABLE', 'AI service temporarily unavailable');
  }
}
