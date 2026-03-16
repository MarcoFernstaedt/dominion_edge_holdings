/**
 * EmailAdapter
 *
 * Email sending adapter supporting SMTP and future providers (SendGrid, Resend).
 * When email is not configured: stores emails as drafts, never throws.
 * Critical failure protection: partial send failures abort the whole batch.
 */

import IntegrationRegistry from '../services/IntegrationRegistry.js';
import { withRetry, criticalGuard } from '../utils/retry.js';

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
    auth:   { user: cfg.user, pass: process.env.SMTP_PASSWORD },
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
    onRetry: (attempt, err, delay) => console.warn(`[EmailAdapter] retry ${attempt} in ${delay}ms — ${err.message}`),
  });
}

// ─── Adapter interface ────────────────────────────────────────────────────────

/**
 * Send a single email.
 * Returns draft result if email integration is disabled or fails.
 */
export async function sendEmail(email) {
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
    return { sent: true, draft: false, ...result };
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

export const EmailAdapter = { sendEmail, sendBatch, validateEmail, saveDraft };
export default EmailAdapter;
