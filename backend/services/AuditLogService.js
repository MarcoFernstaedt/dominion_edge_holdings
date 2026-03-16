/**
 * AuditLogService — Deterministic. No AI calls.
 *
 * Immutable append-only audit log for all significant platform events.
 * In production replace _log array with a persistent store (MongoDB, PostgreSQL).
 */

import crypto from 'crypto';

const _log = [];
const MAX_ENTRIES = 10000;

export const AUDIT_EVENTS = {
  // CRM
  COMPANY_CREATED:        'company.created',
  COMPANY_UPDATED:        'company.updated',
  COMPANY_DELETED:        'company.deleted',
  CONTACT_CREATED:        'contact.created',
  CONTACT_UPDATED:        'contact.updated',

  // Deals
  DEAL_CREATED:           'deal.created',
  DEAL_STAGE_CHANGED:     'deal.stage_changed',
  DEAL_DELETED:           'deal.deleted',

  // Meetings
  MEETING_CREATED:        'meeting.created',
  MEETING_CONFIRMED:      'meeting.confirmed',
  MEETING_SCHEDULED:      'meeting.scheduled',
  MEETING_COMPLETED:      'meeting.completed',
  MEETING_CANCELLED:      'meeting.cancelled',
  MEETING_RESCHEDULED:    'meeting.rescheduled',
  MEETING_NO_SHOW:        'meeting.no_show',
  MEETING_PREP_CREATED:   'meeting.prep_task_created',
  MEETING_FOLLOWUP_CREATED: 'meeting.followup_task_created',

  // AI
  AGENT_RUN:              'agent.run',
  AI_CACHE_HIT:           'ai.cache_hit',

  // Settings
  SETTINGS_UPDATED:       'settings.updated',

  // Auth / System
  SYSTEM_STARTUP:         'system.startup',
};

/**
 * Append an audit entry. Returns the entry.
 *
 * @param {string} event      One of AUDIT_EVENTS values
 * @param {string} entityType e.g. 'company', 'deal', 'meeting'
 * @param {string} entityId   UUID
 * @param {object} [data]     Relevant snapshot / diff
 * @param {string} [actor]    Who triggered this (user id or 'system')
 */
export function log(event, entityType, entityId, data = {}, actor = 'system') {
  const entry = {
    id: crypto.randomUUID(),
    event,
    entityType,
    entityId,
    actor,
    data,
    timestamp: new Date().toISOString(),
  };

  _log.push(entry);

  // Trim to max size (drop oldest)
  if (_log.length > MAX_ENTRIES) _log.splice(0, _log.length - MAX_ENTRIES);

  return entry;
}

/**
 * Query the log with optional filters.
 */
export function query({ entityId, entityType, event, limit = 50, offset = 0 } = {}) {
  let results = [..._log].reverse(); // newest first
  if (entityId)   results = results.filter((e) => e.entityId === entityId);
  if (entityType) results = results.filter((e) => e.entityType === entityType);
  if (event)      results = results.filter((e) => e.event === event);
  return results.slice(offset, offset + limit);
}

export function count()  { return _log.length; }
export function recent(n = 20) { return [..._log].reverse().slice(0, n); }

export const AuditLogService = { log, query, count, recent, AUDIT_EVENTS };
export default AuditLogService;
