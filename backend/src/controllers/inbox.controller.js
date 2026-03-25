import store       from '../store.js';
import IntegrationRegistry from '../../services/IntegrationRegistry.js';
import { errorResponse } from '../middleware/errorResponse.js';
import { uid, nowIso, findById, getSafeModel } from '../lib/helpers.js';
import { DEH_SYSTEM_PROMPT } from '../config/constants.js';
import { createAnthropicMessage } from '../lib/aiClient.js';

export async function listThreads(req, res) {
  try {
    const { needsReply, status } = req.query;

    // Try Gmail first when Google integration is available
    const guard = IntegrationRegistry.guard('google');
    if (guard.ok) {
      try {
        const { GoogleWorkspaceProvider } = await import('../../services/providers/GoogleWorkspaceProvider.js');
        const result = await GoogleWorkspaceProvider.listThreads({ maxResults: 50 });
        let threads = result.threads || [];
        if (needsReply === 'true') threads = threads.filter((t) => t.needsReply);
        if (status && typeof status === 'string') threads = threads.filter((t) => t.status === status);
        return res.json(threads);
      } catch (err) {
        IntegrationRegistry.recordError('google', err.message);
        // fall through to store
      }
    }

    // Fallback: in-memory store
    let results = [...store.emailThreads];
    if (needsReply === 'true') results = results.filter((t) => t.needsReply);
    if (status && typeof status === 'string') results = results.filter((t) => t.status === status);
    results.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve threads');
  }
}

export async function getThread(req, res) {
  try {
    const guard = IntegrationRegistry.guard('google');
    if (guard.ok) {
      try {
        const { GoogleWorkspaceProvider } = await import('../../services/providers/GoogleWorkspaceProvider.js');
        const thread = await GoogleWorkspaceProvider.getThread(req.params.id);
        if (thread) return res.json(thread);
      } catch (err) {
        IntegrationRegistry.recordError('google', err.message);
        // fall through to store
      }
    }

    // Fallback: in-memory store
    const thread = findById(store.emailThreads, req.params.id);
    if (!thread) return errorResponse(res, 404, 'NOT_FOUND', 'Thread not found');
    res.json(thread);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve thread');
  }
}

export async function compose(req, res) {
  try {
    const thread = {
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: 'sent',
      direction: 'outbound',
      needsReply: false,
      subject: req.validated.subject,
      messages: [{
        id: uid(),
        from: store.settings.fromEmail || 'marco@dominionedge.com',
        to: req.validated.to,
        subject: req.validated.subject,
        body: req.validated.body || '',
        sentAt: nowIso(),
        direction: 'outbound',
      }],
      ...req.validated,
    };

    // Try to send via Gmail when Google integration is available
    const guard = IntegrationRegistry.guard('google');
    if (guard.ok) {
      try {
        const { GoogleWorkspaceProvider } = await import('../../services/providers/GoogleWorkspaceProvider.js');
        await GoogleWorkspaceProvider.sendEmail({
          to:      req.validated.to,
          subject: req.validated.subject,
          html:    req.validated.body || '',
          threadId: req.validated.threadId || undefined,
        });
        IntegrationRegistry.recordSuccess('google');
      } catch (err) {
        IntegrationRegistry.recordError('google', err.message);
        thread.status = 'draft';
        thread._sendError = err.message;
      }
    } else {
      thread.status = 'draft';
      thread._degradedMessage = guard.degradedMessage;
    }

    store.emailThreads.push(thread);

    if (req.validated.companyId) {
      store.interactions.push({
        id: uid(),
        companyId: req.validated.companyId,
        contactId: req.validated.contactId || undefined,
        type: 'email',
        direction: 'outbound',
        subject: req.validated.subject,
        notes: req.validated.body,
        createdAt: nowIso(),
      });
    }

    res.status(201).json(thread);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compose email');
  }
}

export function listOutreachTemplates(req, res) {
  try {
    const { templateType } = req.query;
    let results = [...(store.outreachTemplates || [])];
    if (templateType && typeof templateType === 'string') results = results.filter((t) => t.templateType === templateType);
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve templates');
  }
}

export async function generateOutreach(req, res) {
  if (!store.settings.aiDraftingEnabled) {
    return errorResponse(res, 403, 'FEATURE_DISABLED', 'AI drafting is disabled in settings');
  }

  const { templateType, companyName, ownerName, context } = req.validated;
  const typeDescriptions = {
    seller_outreach:    'initial cold outreach to a business owner exploring acquisition',
    seller_follow_up:   'warm follow-up to a seller who has not responded',
    board_outreach:     'invitation to join an acquisition advisory board',
    lender_outreach:    'introduction to a lender for SBA 7(a) financing',
    networking_outreach:'networking message for deal sourcing',
  };

  try {
    const message = await createAnthropicMessage({
      model: getSafeModel(store.settings),
      max_tokens: 1024,
      system: DEH_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Draft a personalized ${typeDescriptions[templateType]} email.\nCompany: ${companyName || '[Company]'}\nOwner: ${ownerName || '[Owner]'}\nFrom: Marco Fernstaedt, Dominion Edge Holdings\nContext: ${context || 'None'}\n\nReturn JSON only: {"subject": "...", "body": "..."}`,
      }],
    });

    const text = message.content[0]?.text ?? '';
    try {
      const match = text.match(/\{[\s\S]*\}/);
      const json = match ? JSON.parse(match[0]) : {};
      res.json({ subject: json.subject || '', body: json.body || text });
    } catch {
      res.json({ subject: `Inquiry: ${companyName || 'Your Business'}`, body: text });
    }
  } catch (err) {
    console.error('[outreach/generate]', err.message);
    errorResponse(res, 503, 'AI_UNAVAILABLE', 'AI drafting service temporarily unavailable');
  }
}
