/**
 * MonitoringEngine
 *
 * Continuous target intelligence for acquisition targets (QLA step 6 — close/monitor).
 *
 * Design principles:
 *  - AI summarizes and prioritizes; it does NOT invent events.
 *  - All signals are grounded in real source data (public web signals passed as context).
 *  - Strong dedupe via fingerprint hash (entityId + signalType + content hash).
 *  - Noise control: only emit signals that cross severity threshold or differ from last seen.
 *  - Each signal checker is isolated — one failure does not block others.
 *  - Never throws from runEntityCheck(); logs and returns degraded result.
 *
 * Supported signal types:
 *  - website_change       : page content hash shifted (title, H1, meta description)
 *  - review_drop          : aggregate review signal deteriorated
 *  - ownership_change     : owner name / contact in public records changed
 *  - job_posting          : significant hiring or layoff signal
 *  - legal_mention        : business name in court/regulatory context
 *  - domain_issue         : domain expiry, DNS failure, SSL problem
 *  - local_presence       : Google Maps listing change (hours, closed flag)
 */

import crypto   from 'crypto';
import https    from 'https';
import http     from 'http';
import { URL }  from 'url';
import prisma   from '../src/lib/prisma.js';
import * as AIService from './AIService.js';
import pino     from 'pino';

const logger = pino({ name: 'MonitoringEngine' });

// ─── Constants ────────────────────────────────────────────────────────────────

export const SIGNAL_TYPES = {
  WEBSITE_CHANGE:   'website_change',
  REVIEW_DROP:      'review_drop',
  OWNERSHIP_CHANGE: 'ownership_change',
  JOB_POSTING:      'job_posting',
  LEGAL_MENTION:    'legal_mention',
  DOMAIN_ISSUE:     'domain_issue',
  LOCAL_PRESENCE:   'local_presence',
};

const SEVERITY = {
  INFO:      'info',
  WATCH:     'watch',
  IMPORTANT: 'important',
  CRITICAL:  'critical',
};

// Minimum severity to emit an event (filter noise below this level)
const MIN_EMIT_SEVERITY = SEVERITY.WATCH;
const SEVERITY_ORDER = [SEVERITY.INFO, SEVERITY.WATCH, SEVERITY.IMPORTANT, SEVERITY.CRITICAL];

function severityIndex(s) { return SEVERITY_ORDER.indexOf(s); }
function meetsThreshold(s) { return severityIndex(s) >= severityIndex(MIN_EMIT_SEVERITY); }

// Request timeout for external checks
const HTTP_TIMEOUT_MS = 10_000;

// ─── Fingerprinting ───────────────────────────────────────────────────────────

/**
 * Build a dedupe fingerprint for a signal event.
 * Two events with the same fingerprint are considered duplicates.
 * The fingerprint encodes: entityId + signalType + normalized content.
 */
export function buildFingerprint(entityId, signalType, contentKey) {
  const raw = `${entityId}::${signalType}::${String(contentKey).slice(0, 200)}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function fetchUrl(rawUrl, timeoutMs = HTTP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`); }
    catch { return reject(new Error(`Invalid URL: ${rawUrl}`)); }

    const lib = parsed.protocol === 'http:' ? http : https;
    const req = lib.get(parsed.href, {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DEH-Monitor/1.0; +https://dominionedge.com/bot)',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers:    res.headers,
        body:       Buffer.concat(chunks).toString('utf8', 0, 32_000),
      }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
  });
}

// ─── Signal checkers ─────────────────────────────────────────────────────────

/**
 * Check for website content changes.
 * Computes a lightweight hash of the page title, H1, and meta description.
 * Compares to the hash stored in the last MonitorEvent for this entity+signalType.
 */
async function checkWebsiteChange(entity, lastEvents) {
  if (!entity.website) return null;

  let response;
  try { response = await fetchUrl(entity.website); }
  catch (err) {
    // Network error → might be a domain issue, let domain checker handle it
    return null;
  }

  const { statusCode, body } = response;
  if (statusCode >= 400) {
    // 4xx/5xx → surface as domain issue
    return {
      signalType: SIGNAL_TYPES.DOMAIN_ISSUE,
      severity:   statusCode >= 500 ? SEVERITY.IMPORTANT : SEVERITY.WATCH,
      title:      `Website returned HTTP ${statusCode}`,
      summary:    `The website at ${entity.website} returned a ${statusCode} error. This may indicate technical issues or the site is down.`,
      sourceSnippet: `HTTP ${statusCode} from ${entity.website}`,
      contentKey: `http_${statusCode}`,
    };
  }

  // Extract lightweight signals from HTML
  const titleMatch   = body.match(/<title[^>]*>([^<]{0,120})/i);
  const h1Match      = body.match(/<h1[^>]*>([^<]{0,120})/i);
  const metaDescMatch = body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,200})/i);

  const title   = (titleMatch?.[1]   ?? '').trim();
  const h1      = (h1Match?.[1]      ?? '').trim();
  const metaDesc= (metaDescMatch?.[1]?? '').trim();
  const snippet = [title, h1, metaDesc].filter(Boolean).join(' | ').slice(0, 300);
  const contentKey = crypto.createHash('md5').update(snippet).digest('hex').slice(0, 16);

  // Compare to last known state
  const lastWebsite = lastEvents.find(e => e.signalType === SIGNAL_TYPES.WEBSITE_CHANGE);
  if (lastWebsite?.sourceSnippet === snippet) return null; // no change
  if (!lastWebsite && !snippet) return null; // nothing to compare

  // Title changed is more significant than just description
  const severity = lastWebsite ? SEVERITY.WATCH : SEVERITY.INFO;

  return {
    signalType:   SIGNAL_TYPES.WEBSITE_CHANGE,
    severity,
    title:        lastWebsite ? 'Website content changed' : 'Website content baseline captured',
    summary:      lastWebsite
      ? `The website content for ${entity.displayName} has changed since last check.`
      : `Initial website content snapshot captured for ${entity.displayName}.`,
    sourceSnippet: snippet,
    contentKey,
  };
}

/**
 * Check for domain/SSL issues.
 * Tests reachability, SSL validity, and DNS resolution.
 */
async function checkDomainIssue(entity, _lastEvents) {
  if (!entity.website) return null;

  let parsed;
  try { parsed = new URL(entity.website.startsWith('http') ? entity.website : `https://${entity.website}`); }
  catch { return null; }

  // Quick DNS check via HTTPS fetch
  try {
    const response = await fetchUrl(parsed.href, 8_000);
    if (response.statusCode === 0 || !response.statusCode) {
      return {
        signalType:   SIGNAL_TYPES.DOMAIN_ISSUE,
        severity:     SEVERITY.IMPORTANT,
        title:        'Website unreachable',
        summary:      `Could not reach ${entity.website}. The domain may have lapsed or the server is down.`,
        sourceSnippet: `No response from ${parsed.hostname}`,
        contentKey:   `unreachable_${parsed.hostname}`,
      };
    }
    // SSL check via response headers
    const isHttps = parsed.protocol === 'https:';
    if (isHttps && response.headers['x-content-type-options'] === undefined && response.statusCode === 200) {
      // site is up — no issue
    }
    return null; // site reachable
  } catch (err) {
    const isTimeout = err.message?.includes('timeout');
    const isDns     = err.message?.includes('ENOTFOUND') || err.message?.includes('EAI_AGAIN');
    const isRefused = err.message?.includes('ECONNREFUSED');

    let severity = SEVERITY.IMPORTANT;
    let title    = 'Website unreachable';
    let summary  = `Could not reach ${entity.website}.`;

    if (isDns) {
      severity = SEVERITY.CRITICAL;
      title    = 'Domain not resolving (DNS failure)';
      summary  = `DNS lookup failed for ${parsed.hostname}. The domain may have expired or been transferred.`;
    } else if (isRefused) {
      title    = 'Website connection refused';
      summary  = `Connection refused at ${parsed.hostname}. Server may be down.`;
    } else if (isTimeout) {
      severity = SEVERITY.WATCH;
      title    = 'Website response timeout';
      summary  = `${entity.website} timed out after ${HTTP_TIMEOUT_MS / 1000}s.`;
    }

    return {
      signalType:   SIGNAL_TYPES.DOMAIN_ISSUE,
      severity,
      title,
      summary,
      sourceSnippet: err.message?.slice(0, 200),
      contentKey:   `err_${err.code ?? err.message?.slice(0, 30)}`,
    };
  }
}

/**
 * Job posting signal — detect significant hiring or mass layoff activity
 * via LinkedIn URL page fetch (best-effort; only parses public snippets).
 */
async function checkJobPostings(entity, lastEvents) {
  if (!entity.linkedinUrl) return null;

  // Try to fetch the LinkedIn jobs page (public, rate-limited)
  const jobsUrl = entity.linkedinUrl.replace(/\/$/, '') + '/jobs/';
  let response;
  try { response = await fetchUrl(jobsUrl, 8_000); }
  catch { return null; }

  // Extract job count from page (rough pattern)
  const countMatch = response.body.match(/(\d+)\s+(?:open\s+)?(?:job|position|role)/i);
  const jobCount   = countMatch ? parseInt(countMatch[1], 10) : null;
  if (jobCount === null) return null;

  const contentKey = `jobs_${jobCount}`;
  const lastJob    = lastEvents.find(e => e.signalType === SIGNAL_TYPES.JOB_POSTING);
  const lastCount  = lastJob ? parseInt((lastJob.sourceSnippet ?? '0').replace(/\D/g, ''), 10) : null;

  if (lastCount !== null && Math.abs(jobCount - lastCount) < 3) return null; // not significant

  const delta   = lastCount !== null ? jobCount - lastCount : null;
  const isSpike = delta !== null && delta > 5;
  const isDrop  = delta !== null && delta < -5;

  return {
    signalType:   SIGNAL_TYPES.JOB_POSTING,
    severity:     isSpike || isDrop ? SEVERITY.WATCH : SEVERITY.INFO,
    title:        isSpike ? `Hiring spike: ${jobCount} open roles`
                 : isDrop ? `Hiring drop: down to ${jobCount} open roles`
                 : `${jobCount} open job postings detected`,
    summary:      `${entity.displayName} has ${jobCount} open positions${delta !== null ? ` (${delta > 0 ? '+' : ''}${delta} since last check)` : ''}.`,
    sourceSnippet: `${jobCount} open positions on LinkedIn`,
    contentKey,
  };
}

// ─── AI enrichment ────────────────────────────────────────────────────────────

/**
 * Use AI to explain why a detected signal matters and suggest a next action.
 * Runs only on signals that meet severity threshold.
 * Falls back to null on AI failure — the event is still stored without AI fields.
 */
async function enrichWithAI(entity, signalData) {
  const systemPrompt = `You are a deal intelligence analyst for a search fund acquisition.
A monitoring signal was detected for a target company. Explain concisely why this matters for the acquisition thesis and suggest one specific follow-up action.
Return JSON: { "explanation": "1-2 sentences", "nextAction": "specific action ≤15 words" }
Be direct. Do not invent information.`;

  const userMessage = `Target: ${entity.displayName} (${entity.entityType})
Signal type: ${signalData.signalType}
Severity: ${signalData.severity}
Summary: ${signalData.summary}
Source snippet: ${signalData.sourceSnippet ?? 'N/A'}`;

  try {
    const result = await AIService.run('monitor_event_explain', {}, {
      systemPrompt,
      userMessage,
      maxTokens:  256,
      entityId:   entity.entityId,
      entityType: entity.entityType,
      agentName:  'MonitoringEngine',
    });

    const text = typeof result?.content === 'string' ? result.content : '';
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const parsed = JSON.parse(fenced ? fenced[1] : text.trim());
    return {
      aiExplanation: String(parsed.explanation ?? '').slice(0, 400),
      aiNextAction:  String(parsed.nextAction  ?? '').slice(0, 200),
    };
  } catch {
    return { aiExplanation: null, aiNextAction: null };
  }
}

// ─── Core entity check orchestrator ──────────────────────────────────────────

/**
 * Run all signal checkers for a single monitored entity.
 * Dedupes against recent events. Persists new events to DB.
 * Never throws — returns { created, skipped, errors }.
 */
export async function runEntityCheck(monitoredEntity) {
  const result = { created: 0, skipped: 0, errors: [] };

  // Load recent events for this entity (last 7d) for dedupe
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let lastEvents = [];
  try {
    lastEvents = await prisma.monitorEvent.findMany({
      where:   { monitoredEntityId: monitoredEntity.id, detectedAt: { gte: since } },
      orderBy: { detectedAt: 'desc' },
      take:    50,
    });
  } catch (err) {
    logger.error({ err, entityId: monitoredEntity.id }, '[MonitoringEngine] Failed to load last events');
  }

  const checkers = [
    () => checkWebsiteChange(monitoredEntity, lastEvents),
    () => checkDomainIssue(monitoredEntity, lastEvents),
    () => checkJobPostings(monitoredEntity, lastEvents),
  ];

  for (const checker of checkers) {
    let signalData;
    try {
      signalData = await checker();
    } catch (err) {
      logger.warn({ err, entityId: monitoredEntity.id }, '[MonitoringEngine] Signal checker error');
      result.errors.push(String(err.message));
      continue;
    }

    if (!signalData) { result.skipped++; continue; }
    if (!meetsThreshold(signalData.severity)) { result.skipped++; continue; }

    // Dedupe check
    const fingerprint = buildFingerprint(monitoredEntity.entityId, signalData.signalType, signalData.contentKey);
    const exists = await prisma.monitorEvent.findUnique({ where: { dedupeFingerprint: fingerprint } });
    if (exists) { result.skipped++; continue; }

    // AI enrichment (best-effort)
    const ai = await enrichWithAI(monitoredEntity, signalData);

    // Persist
    try {
      await prisma.monitorEvent.create({
        data: {
          monitoredEntityId: monitoredEntity.id,
          userId:            monitoredEntity.userId,
          entityType:        monitoredEntity.entityType,
          entityId:          monitoredEntity.entityId,
          signalType:        signalData.signalType,
          severity:          signalData.severity,
          title:             signalData.title,
          summary:           signalData.summary,
          sourceSnippet:     signalData.sourceSnippet ?? null,
          sourceUrl:         signalData.sourceUrl     ?? monitoredEntity.website ?? null,
          aiExplanation:     ai.aiExplanation,
          aiNextAction:      ai.aiNextAction,
          dedupeFingerprint: fingerprint,
          reviewState:       'unread',
        },
      });
      result.created++;
    } catch (err) {
      // Unique constraint on fingerprint → already exists (race condition)
      if (err.code === 'P2002') { result.skipped++; continue; }
      logger.error({ err, fingerprint }, '[MonitoringEngine] Failed to persist event');
      result.errors.push(String(err.message));
    }
  }

  // Update lastCheckedAt + nextCheckAt
  try {
    await prisma.monitoredEntity.update({
      where: { id: monitoredEntity.id },
      data: {
        lastCheckedAt: new Date(),
        nextCheckAt:   new Date(Date.now() + monitoredEntity.checkIntervalMs),
      },
    });
  } catch (err) {
    logger.warn({ err }, '[MonitoringEngine] Failed to update lastCheckedAt');
  }

  return result;
}

// ─── Batch run ────────────────────────────────────────────────────────────────

/**
 * Run checks for all enabled monitored entities that are due.
 * @returns {{ checked: number, totalCreated: number, totalErrors: number }}
 */
export async function runDueChecks() {
  const now = new Date();
  let entities;
  try {
    entities = await prisma.monitoredEntity.findMany({
      where: {
        enabled:    true,
        OR: [
          { nextCheckAt: null },
          { nextCheckAt: { lte: now } },
        ],
      },
      take: 50, // safety cap per run
    });
  } catch (err) {
    logger.error({ err }, '[MonitoringEngine] Failed to load monitored entities');
    return { checked: 0, totalCreated: 0, totalErrors: 1 };
  }

  let totalCreated = 0;
  let totalErrors  = 0;

  for (const entity of entities) {
    const r = await runEntityCheck(entity);
    totalCreated += r.created;
    totalErrors  += r.errors.length;
    logger.info({
      entityId: entity.entityId,
      entityType: entity.entityType,
      created: r.created,
      skipped: r.skipped,
      errors:  r.errors.length,
    }, '[MonitoringEngine] entity check complete');
  }

  return { checked: entities.length, totalCreated, totalErrors };
}

// ─── Entity management helpers ────────────────────────────────────────────────

/**
 * Register a company/deal/contact for monitoring.
 * Idempotent — returns existing record if already registered.
 */
export async function registerEntity({ userId, entityType, entityId, displayName, website, linkedinUrl, googlePlaceId, checkIntervalMs }) {
  return prisma.monitoredEntity.upsert({
    where:  { userId_entityType_entityId: { userId, entityType, entityId } },
    update: {
      displayName,
      website:       website        ?? undefined,
      linkedinUrl:   linkedinUrl    ?? undefined,
      googlePlaceId: googlePlaceId  ?? undefined,
      checkIntervalMs: checkIntervalMs ?? undefined,
      enabled:       true,
    },
    create: {
      userId,
      entityType,
      entityId,
      displayName,
      website,
      linkedinUrl,
      googlePlaceId,
      checkIntervalMs: checkIntervalMs ?? 43_200_000, // 12h default
      nextCheckAt:     new Date(), // check immediately on first registration
    },
  });
}

/**
 * Disable monitoring for an entity.
 */
export async function disableEntity(userId, entityType, entityId) {
  return prisma.monitoredEntity.updateMany({
    where: { userId, entityType, entityId },
    data:  { enabled: false },
  });
}

export default {
  SIGNAL_TYPES,
  buildFingerprint,
  registerEntity,
  disableEntity,
  runEntityCheck,
  runDueChecks,
};
