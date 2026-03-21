/**
 * AdapterContract.js — Canonical adapter interface definitions.
 *
 * Re-exports the contracts from the existing backend/adapters/AdapterContract.js
 * under the new src/ path so both old and new code can import from here.
 *
 * New code should import from this path:
 *   import { BaseAdapter, SourceAdapter } from '../src/adapters/contracts/AdapterContract.js'
 */
export {
  BaseAdapter,
  SourceAdapter,
  EmailAdapter,
  CalendarAdapter,
  normalizedSourceRecord,
  normalizedEmailRequest,
  normalizedEmailResult,
  normalizedMeetingRequest,
  normalizedCalendarResult,
} from '../../adapters/AdapterContract.js';

/**
 * Capability flags — all valid capability strings for type safety.
 */
export const CAPABILITIES = Object.freeze({
  // Source adapters
  LEAD_DISCOVERY:       'lead_discovery',
  CONTACT_ENRICHMENT:   'contact_enrichment',
  COMPANY_LOOKUP:       'company_lookup',
  BULK_IMPORT:          'bulk_import',

  // Email adapters
  SEND_EMAIL:           'send_email',
  CREATE_DRAFT:         'create_draft',
  THREAD_SYNC:          'thread_sync',
  OAUTH_SEND:           'oauth_send',

  // Calendar adapters
  CREATE_MEETING:       'create_meeting',
  UPDATE_MEETING:       'update_meeting',
  CANCEL_MEETING:       'cancel_meeting',
  AVAILABILITY_CHECK:   'availability_check',
});

/**
 * Adapter status values.
 */
export const ADAPTER_STATUS = Object.freeze({
  HEALTHY:       'healthy',
  DEGRADED:      'degraded',
  UNAVAILABLE:   'unavailable',
  UNCONFIGURED:  'unconfigured',
  UNKNOWN:       'unknown',
});

/**
 * Normalized provider health shape — every adapter's healthCheck() must
 * return this structure.
 */
export function normalizedHealthResult({ ok, latencyMs, error = null, details = null } = {}) {
  return {
    ok:        !!ok,
    latencyMs: latencyMs ?? 0,
    error:     error ?? null,
    details:   details ?? null,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Normalized adapter config validation result.
 */
export function normalizedConfigValidation({ valid, missingFields = [], warnings = [] } = {}) {
  return { valid: !!valid, missingFields, warnings };
}
