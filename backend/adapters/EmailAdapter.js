/**
 * EmailAdapter
 *
 * Email sending adapter supporting SMTP and future providers (SendGrid, Resend).
 * When email is not configured: stores emails as drafts, never throws.
 * Critical failure protection: partial send failures abort the whole batch.
 */

import IntegrationRegistry from '../services/IntegrationRegistry.js';
import { withRetry, criticalGuard } from '../utils/retry.js';
import env from '../src/config/env.js';

// ─── Draft result ─────────────────────────────────────────────────────────────
function draftResult(email, guard) {
  return {
    sent:      false,
    draft:     true,
    emailId:   email.id || null,
    warning:   guard?.degradedMessage || 'Email sending is disabled because no email provider is configured.',
    message:   'Email has been saved as a draft. Please send it manually.',
    status:    guard?.status || 'disabled',
  };
}

// ─── SMTP send (requires nodemailer) ─────────────────────────────────────────
async function smtpSend(email, cfg) {
  // Dynamic import — nodemailer is optional
  let nodemailer;
  try {
    nodemailer = (await import('nodemailer')).default;
  } catch {
    throw new Error('nodemailer is not installed. Run: npm install nodemailer');
  }

  const transporter = nodemailer.createTransport({
    host:   cfg.host,
    port:   cfg.port,
    secure: cfg.port === 465,
    auth:   { user: cfg.user, pass: env.SMTP_PASS },
  });

  return withRetry(async () => {
    const info = await transporter.sendMail({
      from:    `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to:      email.to,
      subject: email.subject,
      text:    email.body,
      html:    email.html || undefined,
    });
    return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
  }, {
    maxRetries:  3,
    baseDelayMs: 1000,
    onRetry: (attempt, err, delay) => logger.warn({ attempt, delay, err: err.message }, '[EmailAdapter] SMTP retry'),
  });
}

// ─── Gmail send (requires GOOGLE_REFRESH_TOKEN) ───────────────────────────────
async function gmailSend(email) {
  const { GoogleWorkspaceProvider } = await import('../services/providers/GoogleWorkspaceProvider.js');
  return GoogleWorkspaceProvider.sendEmail({
    to:             email.to,
    subject:        email.subject,
    body:           email.body,
    html:           email.html,
    replyToThreadId: email.replyToThreadId,
  });
}

// ─── Adapter interface ────────────────────────────────────────────────────────

/**
 * Send a single email.
 * Provider selection: 'google' → Gmail API, 'smtp' → SMTP, otherwise draft.
 * Returns draft result if email integration is disabled or fails.
 */
export async function sendEmail(email) {
  // Try Google provider first if configured
  const googleGuard = IntegrationRegistry.guard('google');
  if (googleGuard.ok) {
    try {
      const result = await gmailSend(email);
      IntegrationRegistry.recordSuccess('google');
      IntegrationRegistry.recordSuccess('email');
      return { sent: true, draft: false, provider: 'gmail', ...result };
    } catch (err) {
      IntegrationRegistry.recordError('google', err.message);
      // Fall through to SMTP if gmail fails
    }
  }

  const guard = IntegrationRegistry.guard('email');
  if (!guard.ok) return draftResult(email, guard);

  const cfg = IntegrationRegistry.getConfig('email');
  try {
    let result;
    if (cfg.provider === 'smtp') {
      const raw = await smtpSend(email, cfg);
      // Critical failure protection: if any recipients rejected, abort
      if (raw.rejected?.length > 0) {
        throw Object.assign(
          new Error(`Partial send failure: ${raw.rejected.length} recipients rejected`),
          { critical: true, rejected: raw.rejected }
        );
      }
      result = raw;
    } else {
      throw new Error(`Unsupported email provider: ${cfg.provider}`);
    }

    IntegrationRegistry.recordSuccess('email');
    return { sent: true, draft: false, provider: 'smtp', ...result };
  } catch (err) {
    // Critical failures (partial send) bubble up with abort flag
    if (err.critical) throw err;

    IntegrationRegistry.recordError('email', err.message);
    return draftResult(email, { degradedMessage: 'Email service is unreachable. Your email has been saved as a draft.', status: 'unreachable' });
  }
}

/**
 * Send a batch of emails respecting send limits.
 * Uses critical guard: if partial failure would cause inconsistency, aborts.
 *
 * @param {Array}  emails         List of { to, subject, body, id }
 * @param {object} [limits]       { maxPerBatch }
 * @returns {{ sent, failed, drafts }}
 */
export async function sendBatch(emails, { maxPerBatch = 50 } = {}) {
  const guard = IntegrationRegistry.guard('email');
  if (!guard.ok) {
    return { sent: [], failed: [], drafts: emails.map((e) => draftResult(e, guard)) };
  }

  const batch  = emails.slice(0, maxPerBatch);
  const sent   = [];
  const failed = [];
  const drafts = [];

  for (const email of batch) {
    try {
      const result = await sendEmail(email);
      if (result.sent)  sent.push(result);
      else              drafts.push(result);
    } catch (err) {
      // Critical failure: stop batch immediately (data integrity)
      failed.push({ emailId: email.id, error: err.message, critical: err.critical });
      if (err.critical) break;
    }
  }

  return { sent, failed, drafts };
}

/**
 * Validate an email address (deterministic — no external call).
 */
export function validateEmail(address) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(address);
}

/**
 * List email threads from Gmail.
 * Falls back to empty list when Google is not configured.
 */
export async function listThreads({ query = '', maxResults = 20, pageToken } = {}) {
  const guard = IntegrationRegistry.guard('google');
  if (!guard.ok) {
    return {
      threads: [],
      source:  'internal',
      warning: guard.degradedMessage,
    };
  }
  try {
    const { GoogleWorkspaceProvider } = await import('../services/providers/GoogleWorkspaceProvider.js');
    const result = await GoogleWorkspaceProvider.listThreads({ query, maxResults, pageToken });
    IntegrationRegistry.recordSuccess('google');
    return { ...result, source: 'gmail' };
  } catch (err) {
    IntegrationRegistry.recordError('google', err.message);
    return { threads: [], source: 'internal', warning: err.message };
  }
}

/**
 * Get a single Gmail thread.
 */
export async function getThread(threadId) {
  const guard = IntegrationRegistry.guard('google');
  if (!guard.ok) return { thread: null, warning: guard.degradedMessage };

  try {
    const { GoogleWorkspaceProvider } = await import('../services/providers/GoogleWorkspaceProvider.js');
    const result = await GoogleWorkspaceProvider.getThread(threadId);
    IntegrationRegistry.recordSuccess('google');
    return { thread: result, source: 'gmail' };
  } catch (err) {
    IntegrationRegistry.recordError('google', err.message);
    return { thread: null, warning: err.message };
  }
}

/**
 * Save email as draft (local storage — always works, no external call).
 */
export function saveDraft(email, store) {
  const draft = {
    ...email,
    isDraft:   true,
    createdAt: new Date().toISOString(),
  };
  if (store?.emailThreads) {
    store.emailThreads.push(draft);
  }
  return draft;
}

export const EmailAdapter = { sendEmail, sendBatch, validateEmail, saveDraft, listThreads, getThread };
export default EmailAdapter;
