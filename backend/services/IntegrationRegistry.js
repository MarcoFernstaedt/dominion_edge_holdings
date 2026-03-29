/**
 * IntegrationRegistry
 *
 * Central registry for all external integrations.
 * Provides config access, status tracking, and the pre-call guard
 * that enforces: check enabled → check credentials → proceed or degrade.
 *
 * Integration config lives in store.settings (persisted) and is mirrored
 * into this registry at startup.
 *
 * Status values: connected | disabled | misconfigured | unreachable
 */

import crypto from 'crypto';

// ─── Default integration config ───────────────────────────────────────────────
export const DEFAULT_INTEGRATIONS = {
  apollo: {
    enabled:    false,
    apiKey:     null,
    baseUrl:    'https://api.apollo.io/v1',
  },
  ai: {
    enabled:    true,
    provider:   'anthropic',
    apiKey:     null,        // resolved from ANTHROPIC_API_KEY env at runtime
    models: {
      haiku:  'claude-haiku-4-5-20251001',
      sonnet: 'claude-sonnet-4-6',
    },
  },
  calendar: {
    enabled:    false,
    provider:   'google',   // 'google' | 'outlook' | 'none'
    credentials: null,
  },
  email: {
    enabled:    false,
    provider:   'smtp',     // 'smtp' | 'sendgrid' | 'resend' | 'google' | 'none'
    host:       null,
    port:       587,
    user:       null,
    fromName:   '',
    fromEmail:  '',
  },
  // Google Workspace — Gmail + Calendar via OAuth2
  google: {
    enabled:      false,
    clientId:     null,
    hasSecret:    false,    // never expose the secret
    hasToken:     false,    // true when GOOGLE_REFRESH_TOKEN is set
    calendarId:   'primary',
    fromEmail:    null,
    fromName:     'Dominion Edge',
    capabilities: ['gmail_send', 'gmail_read', 'calendar_read', 'calendar_write'],
  },
  // Object storage — S3-compatible
  storage: {
    enabled:    false,
    bucket:     null,
    region:     'us-east-1',
    endpoint:   null,       // for non-AWS providers
    hasKey:     false,      // true when AWS_ACCESS_KEY_ID is set
    capabilities: ['upload', 'download', 'delete'],
  },
};

// ─── Status store ─────────────────────────────────────────────────────────────
// integrationStatus collection (in-memory, per spec)
const _status = {};

function _initStatus(name) {
  if (!_status[name]) {
    _status[name] = {
      integrationName: name,
      enabled:         false,
      apiConfigured:   false,
      lastHealthCheck: null,
      lastError:       null,
      status:          'disabled',
    };
  }
}

// ─── Registry class ───────────────────────────────────────────────────────────
class IntegrationRegistryClass {
  constructor() {
    this._config = structuredClone(DEFAULT_INTEGRATIONS);
    for (const name of Object.keys(DEFAULT_INTEGRATIONS)) {
      _initStatus(name);
    }
  }

  /**
   * Sync registry from store.settings and env vars.
   * Call at startup and on settings change.
   */
  syncFromSettings(settings) {
    if (!settings) {
      this._syncFromEnv();
      return;
    }

    // AI
    this._config.ai.enabled  = settings.aiDraftingEnabled !== false;
    this._config.ai.apiKey   = process.env.ANTHROPIC_API_KEY || null;

    // Email (SMTP path)
    this._config.email.enabled    = !!(settings.smtpHost && settings.smtpUser && settings.fromEmail);
    this._config.email.host       = settings.smtpHost   || null;
    this._config.email.port       = settings.smtpPort   || 587;
    this._config.email.user       = settings.smtpUser   || null;
    this._config.email.fromName   = settings.fromName   || '';
    this._config.email.fromEmail  = settings.fromEmail  || '';
    this._config.email.provider   = settings.emailMode  || 'smtp';

    // Apollo
    this._config.apollo.enabled = !!(settings.apolloEnabled && settings.apolloApiKey);
    this._config.apollo.apiKey  = settings.apolloApiKey || null;

    // Calendar (legacy path — uses google provider internally)
    this._config.calendar.enabled  = !!(settings.calendarEnabled && settings.calendarProvider);
    this._config.calendar.provider = settings.calendarProvider || 'none';

    // Google Workspace — env-driven (settings can override enabled flag)
    this._syncGoogleFromEnv(settings);

    // Storage — env-driven
    this._syncStorageFromEnv();

    // Update status snapshots
    this._refreshStatus();
  }

  /**
   * Sync Google + Storage from environment when no user settings are provided.
   * Called at startup before any DB query succeeds.
   */
  _syncFromEnv() {
    this._config.ai.enabled = true;
    this._config.ai.apiKey  = process.env.ANTHROPIC_API_KEY || null;

    const apolloKey = process.env.APOLLO_API_KEY;
    if (apolloKey) {
      this._config.apollo.enabled = true;
      this._config.apollo.apiKey  = apolloKey;
    }

    this._syncGoogleFromEnv(null);
    this._syncStorageFromEnv();
    this._refreshStatus();
  }

  _syncGoogleFromEnv(settings) {
    const clientId  = process.env.GOOGLE_CLIENT_ID;
    const hasSecret = !!(process.env.GOOGLE_CLIENT_SECRET);
    const hasToken  = !!(process.env.GOOGLE_REFRESH_TOKEN);

    this._config.google.clientId   = clientId   || null;
    this._config.google.hasSecret  = hasSecret;
    this._config.google.hasToken   = hasToken;
    this._config.google.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    this._config.google.fromEmail  = process.env.GMAIL_FROM_EMAIL   || null;
    this._config.google.fromName   = process.env.GMAIL_FROM_NAME    || 'Dominion Edge';

    // Enabled when all OAuth2 pieces are present
    const googleReady = !!(clientId && hasSecret && hasToken);
    // settings can override the enabled flag
    this._config.google.enabled = settings?.googleEnabled !== undefined
      ? !!(settings.googleEnabled && googleReady)
      : googleReady;

    // If Google is enabled, also enable the calendar integration
    if (this._config.google.enabled) {
      this._config.calendar.enabled  = true;
      this._config.calendar.provider = 'google';
    }
  }

  _syncStorageFromEnv() {
    const hasKey = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    this._config.storage.bucket   = process.env.S3_BUCKET    || 'dominion-edge';
    this._config.storage.region   = process.env.S3_REGION    || 'us-east-1';
    this._config.storage.endpoint = process.env.S3_ENDPOINT  || null;
    this._config.storage.hasKey   = hasKey;
    this._config.storage.enabled  = hasKey && !!(process.env.S3_BUCKET);
  }

  _refreshStatus() {
    for (const [name, cfg] of Object.entries(this._config)) {
      _initStatus(name);
      const s = _status[name];
      s.enabled       = cfg.enabled;
      s.apiConfigured = this._hasCredentials(name);
      if (!cfg.enabled) {
        s.status = 'disabled';
      } else if (!s.apiConfigured) {
        s.status = 'misconfigured';
      } else if (s.status === 'disabled') {
        s.status = 'connected'; // optimistic until health check says otherwise
      }
    }
  }

  _hasCredentials(name) {
    const cfg = this._config[name];
    if (!cfg) return false;
    switch (name) {
      case 'ai':       return !!(cfg.apiKey || process.env.ANTHROPIC_API_KEY);
      case 'apollo':   return !!(cfg.apiKey);
      case 'email':    return !!(cfg.host && cfg.user && cfg.fromEmail);
      case 'calendar': return !!(cfg.provider && cfg.provider !== 'none');
      case 'google':   return !!(cfg.clientId && cfg.hasSecret && cfg.hasToken);
      case 'storage':  return !!(cfg.hasKey && cfg.bucket);
      default:         return false;
    }
  }

  // ─── Config accessors ───────────────────────────────────────────────────────
  getConfig(name) {
    return this._config[name] ?? null;
  }

  getAllConfig() {
    // Return config without raw secrets
    return Object.fromEntries(
      Object.entries(this._config).map(([name, cfg]) => [
        name,
        { ...cfg, apiKey: cfg.apiKey ? '***' : null, credentials: cfg.credentials ? '***' : null },
      ])
    );
  }

  // ─── Status accessors ───────────────────────────────────────────────────────
  getStatus(name) {
    _initStatus(name);
    return { ..._status[name] };
  }

  getAllStatus() {
    return Object.values(_status).map((s) => ({ ...s }));
  }

  setStatus(name, patch) {
    _initStatus(name);
    Object.assign(_status[name], patch);
  }

  recordError(name, errorMessage) {
    this.setStatus(name, {
      lastError:       errorMessage,
      lastHealthCheck: new Date().toISOString(),
      status:          'unreachable',
    });
  }

  recordSuccess(name) {
    this.setStatus(name, {
      lastError:       null,
      lastHealthCheck: new Date().toISOString(),
      status:          'connected',
    });
  }

  // ─── Pre-call guard (enforces spec's 3-step check) ─────────────────────────
  /**
   * Before using an integration, call this guard.
   * Returns { ok: true } or { ok: false, reason, degradedMessage, status }
   */
  guard(name) {
    const cfg = this._config[name];
    if (!cfg || !cfg.enabled) {
      return {
        ok:               false,
        reason:           'INTEGRATION_DISABLED',
        degradedMessage:  this._disabledMessage(name),
        status:           'disabled',
      };
    }
    if (!this._hasCredentials(name)) {
      return {
        ok:               false,
        reason:           'MISSING_CREDENTIALS',
        degradedMessage:  this._misconfiguredMessage(name),
        status:           'misconfigured',
      };
    }
    const s = _status[name];
    if (s?.status === 'unreachable') {
      return {
        ok:               false,
        reason:           'INTEGRATION_UNREACHABLE',
        degradedMessage:  this._unreachableMessage(name),
        status:           'unreachable',
      };
    }
    return { ok: true };
  }

  // ─── User-facing degraded messages ─────────────────────────────────────────
  _disabledMessage(name) {
    const messages = {
      apollo:   'Apollo integration is not configured. You can still add companies manually or import CSV data.',
      ai:       'AI features are disabled. Template responses will be used instead.',
      calendar: 'Calendar integration is not configured. This meeting will only exist inside the platform.',
      email:    'Email sending is disabled because no email provider is configured. Emails will be saved as drafts.',
      google:   'Google Workspace is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.',
      storage:  'Object storage is not configured. Files will be stored locally. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET.',
    };
    return messages[name] ?? `${name} integration is disabled.`;
  }

  _misconfiguredMessage(name) {
    const messages = {
      apollo:   'Apollo API key is not set. Configure it in Settings → Integrations.',
      ai:       'AI API key is not configured. Add your Anthropic API key in Settings → Integrations.',
      calendar: 'Calendar credentials are not configured. Add them in Settings → Integrations.',
      email:    'Email provider is not fully configured (missing host, user, or from address). Check Settings → Integrations.',
      google:   'Google OAuth credentials are incomplete. Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are all set.',
      storage:  'Storage credentials are incomplete. Ensure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET are all set.',
    };
    return messages[name] ?? `${name} integration credentials are missing.`;
  }

  _unreachableMessage(name) {
    const messages = {
      apollo:   'Apollo service is temporarily unavailable. Lead discovery will resume once connection is restored.',
      ai:       'AI service is temporarily unavailable. Draft generation skipped. Please try again shortly.',
      calendar: 'Calendar provider is unreachable. Meeting saved locally only.',
      email:    'Email service is unreachable. Your email has been saved as a draft.',
      google:   'Google Workspace is temporarily unreachable. Emails and calendar events will not sync until connection is restored.',
      storage:  'Object storage is temporarily unreachable. File uploads are disabled until connection is restored.',
    };
    return messages[name] ?? `${name} service is temporarily unavailable.`;
  }
}

export const IntegrationRegistry = new IntegrationRegistryClass();
export default IntegrationRegistry;
