/**
 * OutreachExecutionAgent
 *
 * DETERMINISTIC — no AI model calls.
 *
 * Coordinates outreach sending: batching, send limits, deliverability checks.
 * Per spec: "Logic must be deterministic."
 */

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_SENDS_PER_DAY   = 50;
const MAX_SENDS_PER_HOUR  = 10;
const MIN_SEND_DELAY_MS   = 30 * 1000; // 30s between sends
const SUPPRESSION_DOMAINS = ['example.com', 'test.com', 'noreply.com'];

/**
 * Plan a send batch from a list of outreach tasks.
 *
 * @param {Array}  tasks        Outreach tasks with { id, toEmail, subject, body, scheduledAt }
 * @param {object} limits       { sentToday, sentThisHour, lastSentAt }
 * @returns {{ agentName, analysisSummary, actionsProposed, confidenceScore, batch, skipped, reasons }}
 */
export function OutreachExecutionAgent({ tasks = [], limits = {} }) {
  const { sentToday = 0, sentThisHour = 0, lastSentAt = null } = limits;

  const batch   = [];
  const skipped = [];

  const msSinceLast = lastSentAt ? Date.now() - new Date(lastSentAt).getTime() : Infinity;

  for (const task of tasks) {
    const reasons = _validateTask(task, { sentToday: sentToday + batch.length, sentThisHour: sentThisHour + batch.length, msSinceLast });
    if (reasons.length > 0) {
      skipped.push({ taskId: task.id, reasons });
    } else {
      batch.push(task);
    }
  }

  return {
    agentName: 'OutreachExecutionAgent',
    analysisSummary: `Scheduled ${batch.length} email(s); skipped ${skipped.length}`,
    actionsProposed: batch.map((t) => `send_email:${t.id}`),
    confidenceScore: 1.0, // deterministic — always certain
    batch,
    skipped,
    sendAfterMs: msSinceLast < MIN_SEND_DELAY_MS ? MIN_SEND_DELAY_MS - msSinceLast : 0,
  };
}

// ─── Deterministic validation rules ──────────────────────────────────────────
function _validateTask(task, { sentToday, sentThisHour, msSinceLast }) {
  const reasons = [];

  if (!task.toEmail || !task.toEmail.includes('@')) {
    reasons.push('INVALID_EMAIL');
  }

  const domain = (task.toEmail || '').split('@')[1]?.toLowerCase();
  if (SUPPRESSION_DOMAINS.includes(domain)) {
    reasons.push('SUPPRESSED_DOMAIN');
  }

  if (task.suppressed === true) {
    reasons.push('CONTACT_SUPPRESSED');
  }

  if (sentToday >= MAX_SENDS_PER_DAY) {
    reasons.push('DAILY_LIMIT_REACHED');
  }

  if (sentThisHour >= MAX_SENDS_PER_HOUR) {
    reasons.push('HOURLY_LIMIT_REACHED');
  }

  if (msSinceLast < MIN_SEND_DELAY_MS && reasons.length === 0) {
    reasons.push('RATE_DELAY_REQUIRED');
  }

  if (task.scheduledAt && new Date(task.scheduledAt) > new Date()) {
    reasons.push('NOT_YET_SCHEDULED');
  }

  return reasons;
}
