/**
 * GoogleOAuthProvider
 *
 * Manages Google OAuth2 token lifecycle using the refresh token grant.
 * Caches the access token in memory and refreshes it automatically before expiry.
 * All Google API adapters (Gmail, Calendar) import this provider.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 */

import env from '../../src/config/env.js';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

// ─── In-memory token cache ────────────────────────────────────────────────────
let _cachedToken = null;
let _expiresAt   = 0;

// ─── Config validation ────────────────────────────────────────────────────────

export function isConfigured() {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
}

export function validateConfig() {
  const missing = [];
  if (!env.GOOGLE_CLIENT_ID)     missing.push('GOOGLE_CLIENT_ID');
  if (!env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  if (!env.GOOGLE_REFRESH_TOKEN) missing.push('GOOGLE_REFRESH_TOKEN');
  return { valid: missing.length === 0, missing };
}

// ─── Token refresh ────────────────────────────────────────────────────────────

/**
 * Returns a valid access token, refreshing if necessary.
 * Throws if credentials are not configured or refresh fails.
 */
export async function getAccessToken() {
  if (!isConfigured()) {
    throw Object.assign(
      new Error('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.'),
      { code: 'GOOGLE_NOT_CONFIGURED' }
    );
  }

  const now = Date.now();
  if (_cachedToken && now < _expiresAt - REFRESH_BUFFER_MS) {
    return _cachedToken;
  }

  return _refresh();
}

async function _refresh() {
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
    client_id:     env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
    signal:  AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(
      new Error(`Google token refresh failed: ${res.status} ${text}`),
      { code: 'TOKEN_REFRESH_FAILED', status: res.status }
    );
  }

  const data = await res.json();
  if (!data.access_token) {
    throw Object.assign(
      new Error('Google token refresh returned no access_token'),
      { code: 'TOKEN_REFRESH_FAILED' }
    );
  }

  _cachedToken = data.access_token;
  // expires_in is in seconds; default to 1 hour if missing
  _expiresAt   = Date.now() + (data.expires_in ?? 3600) * 1000;

  return _cachedToken;
}

/**
 * Force-invalidate the cached token (call after 401 responses).
 */
export function invalidateToken() {
  _cachedToken = null;
  _expiresAt   = 0;
}

export const GoogleOAuthProvider = { isConfigured, validateConfig, getAccessToken, invalidateToken };
export default GoogleOAuthProvider;
