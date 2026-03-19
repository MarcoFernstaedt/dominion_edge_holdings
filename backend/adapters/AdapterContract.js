/**
 * AdapterContract — normalized interface all adapters must implement.
 *
 * Rules:
 * - No raw third-party payloads may cross the adapter boundary.
 * - Every adapter exposes: capabilities, status, healthCheck, normalizedOutput.
 * - Degraded mode is mandatory — adapters must never crash core workflows.
 * - Business logic never speaks to provider SDKs directly.
 *
 * Adapter types:
 *   SourceAdapter   — lead/company enrichment (Apollo, CSV, manual, public dir)
 *   EmailAdapter    — draft, send, thread sync
 *   CalendarAdapter — meeting create/update/cancel
 *
 * Usage: extend BaseAdapter, implement abstract methods, register in IntegrationRegistry.
 */

// ─── Base adapter ─────────────────────────────────────────────────────────────

export class BaseAdapter {
  constructor(name, capabilities = []) {
    this.name         = name;
    this.capabilities = capabilities;   // string[]
    this._status      = 'unknown';      // 'healthy'|'degraded'|'unavailable'|'unconfigured'
    this._lastCheck   = null;
    this._lastError   = null;
  }

  /** @returns {'healthy'|'degraded'|'unavailable'|'unconfigured'} */
  get status() { return this._status; }

  /** True if adapter can handle requests (even in degraded mode). */
  get available() { return this._status === 'healthy' || this._status === 'degraded'; }

  /**
   * Run a health check. Subclasses override _doHealthCheck().
   * @returns {Promise<{ok: boolean, latencyMs: number, error: string|null}>}
   */
  async healthCheck() {
    const start = Date.now();
    try {
      await this._doHealthCheck();
      this._status    = 'healthy';
      this._lastError = null;
      return { ok: true, latencyMs: Date.now() - start, error: null };
    } catch (err) {
      this._status    = 'unavailable';
      this._lastError = err.message;
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    } finally {
      this._lastCheck = new Date().toISOString();
    }
  }

  /** Override in subclass. Throw if unhealthy. */
  async _doHealthCheck() {
    throw new Error(`${this.name}._doHealthCheck() not implemented`);
  }

  /** Metadata about this adapter's state (for /api/integrations/status). */
  getStatusSummary() {
    return {
      name:        this.name,
      capabilities:this.capabilities,
      status:      this._status,
      lastCheck:   this._lastCheck,
      lastError:   this._lastError,
    };
  }
}

// ─── Normalized output types ──────────────────────────────────────────────────

/**
 * Normalized lead/organization record from any source adapter.
 * All fields optional except organization.name.
 */
export function normalizedSourceRecord({
  source_name,
  source_record_id  = null,
  organization      = {},
  contact           = null,
  seller_signal_hints = [],
  confidence        = 'low',
  raw_url           = null,
  ingested_at       = new Date().toISOString(),
} = {}) {
  return {
    source_name,
    source_record_id,
    organization: {
      name:        organization.name         ?? null,
      industry:    organization.industry     ?? null,
      website:     organization.website      ?? null,
      phone:       organization.phone        ?? null,
      email:       organization.email        ?? null,
      city:        organization.city         ?? null,
      state:       organization.state        ?? null,
      revenue:     organization.revenue      ?? null,
      employees:   organization.employees    ?? null,
      founded:     organization.founded      ?? null,
      description: organization.description  ?? null,
    },
    contact: contact ? {
      firstName: contact.firstName ?? null,
      lastName:  contact.lastName  ?? null,
      title:     contact.title     ?? null,
      email:     contact.email     ?? null,
      phone:     contact.phone     ?? null,
      linkedin:  contact.linkedin  ?? null,
    } : null,
    seller_signal_hints,  // string[] e.g. ['retirement_age_owner', 'no_website']
    confidence,           // 'low'|'medium'|'high'
    raw_url,
    ingested_at,
  };
}

/**
 * Normalized email send request.
 */
export function normalizedEmailRequest({
  to,
  cc             = [],
  subject,
  bodyText,
  bodyHtml       = null,
  fromName       = null,
  fromEmail      = null,
  replyTo        = null,
  threadId       = null,
  approvalId     = null,    // must be approved before sending
  entityType     = null,
  entityId       = null,
  tags           = [],
} = {}) {
  return { to, cc, subject, bodyText, bodyHtml, fromName, fromEmail, replyTo, threadId, approvalId, entityType, entityId, tags };
}

/**
 * Normalized email send result.
 */
export function normalizedEmailResult({
  success,
  messageId      = null,
  threadId       = null,
  provider       = null,
  error          = null,
  sentAt         = new Date().toISOString(),
  savedAsDraft   = false,   // true if provider unavailable and saved internally
} = {}) {
  return { success, messageId, threadId, provider, error, sentAt, savedAsDraft };
}

/**
 * Normalized meeting record for calendar adapters.
 */
export function normalizedMeetingRequest({
  title,
  startsAt,
  endsAt,
  attendees      = [],      // [{ name, email }]
  location       = null,
  description    = null,
  meetingType    = null,
  linkedEntityId = null,
  prepPacketId   = null,
} = {}) {
  return { title, startsAt, endsAt, attendees, location, description, meetingType, linkedEntityId, prepPacketId };
}

/**
 * Normalized calendar result.
 */
export function normalizedCalendarResult({
  success,
  calendarEventId = null,
  provider        = null,
  error           = null,
  savedInternally = false,  // true if calendar unavailable
} = {}) {
  return { success, calendarEventId, provider, error, savedInternally };
}

// ─── Source adapter base ──────────────────────────────────────────────────────

export class SourceAdapter extends BaseAdapter {
  constructor(name) {
    super(name, ['lead_discovery', 'contact_enrichment', 'company_lookup']);
  }

  /**
   * Run a discovery/enrichment query.
   * @returns {Promise<import('./AdapterContract.js').normalizedSourceRecord[]>}
   */
  async run(query) {
    throw new Error(`${this.name}.run() not implemented`);
  }

  /** Degraded: return empty array with warning. */
  degradedResult(reason) {
    console.warn(`[${this.name}] Degraded: ${reason}`);
    return [];
  }
}

// ─── Email adapter base ───────────────────────────────────────────────────────

export class EmailAdapter extends BaseAdapter {
  constructor(name) {
    super(name, ['send_email', 'create_draft', 'thread_sync']);
  }

  /**
   * Send an approved email.
   * @param {ReturnType<normalizedEmailRequest>} request
   * @returns {Promise<ReturnType<normalizedEmailResult>>}
   */
  async send(request) {
    throw new Error(`${this.name}.send() not implemented`);
  }

  /** Degraded: save as internal draft task. */
  async degradedSend(request) {
    return normalizedEmailResult({
      success:      false,
      error:        `${this.name} unavailable`,
      savedAsDraft: true,
    });
  }
}

// ─── Calendar adapter base ────────────────────────────────────────────────────

export class CalendarAdapter extends BaseAdapter {
  constructor(name) {
    super(name, ['create_meeting', 'update_meeting', 'cancel_meeting']);
  }

  /**
   * Create a calendar meeting.
   * @param {ReturnType<normalizedMeetingRequest>} request
   * @returns {Promise<ReturnType<normalizedCalendarResult>>}
   */
  async createMeeting(request) {
    throw new Error(`${this.name}.createMeeting() not implemented`);
  }

  /** Degraded: save internally only. */
  async degradedCreate(request) {
    return normalizedCalendarResult({
      success:        false,
      error:          `${this.name} unavailable`,
      savedInternally: true,
    });
  }
}

export default {
  BaseAdapter,
  SourceAdapter,
  EmailAdapter,
  CalendarAdapter,
  normalizedSourceRecord,
  normalizedEmailRequest,
  normalizedEmailResult,
  normalizedMeetingRequest,
  normalizedCalendarResult,
};
