/**
 * CacheService
 *
 * Deterministic in-memory cache with content-hash keying and per-feature
 * expiry rules. No AI calls. Upgrade backing store to Redis via the same
 * interface when needed.
 *
 * Cache key format: <feature>_<entityId>_<contentHash>
 * Example:          company_summary_ABC123_a1b2c3d4
 */

import crypto from 'crypto';

// ─── Expiry rules (ms) ────────────────────────────────────────────────────────
export const CACHE_TTL = {
  company_summary:      30 * 24 * 60 * 60 * 1000,  // 30 days
  email_classification: Infinity,                    // permanent
  outreach_draft:        7 * 24 * 60 * 60 * 1000,  // 7 days
  deal_analysis:        Infinity,                    // until inputs change (caller invalidates)
  daily_briefing:       12 * 60 * 60 * 1000,        // 12 hours
  meeting_summary:      30 * 24 * 60 * 60 * 1000,  // 30 days
  strategy_summary:      7 * 24 * 60 * 60 * 1000,  // 7 days
  default:              24 * 60 * 60 * 1000,        // 1 day fallback
};

// ─── In-memory store ──────────────────────────────────────────────────────────
// Schema mirrors the spec's cachedOutputs collection:
// { feature, entityType, entityId, model, content, createdAt, expiresAt }
const _store = new Map(); // key → entry

// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Deterministic SHA-256 content hash (first 8 hex chars for compactness).
 */
export function contentHash(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 8);
}

/**
 * Build a canonical cache key.
 * @param {string} feature  e.g. 'company_summary', 'email_classification'
 * @param {string} entityId UUID or any stable identifier
 * @param {*}      input    The input payload — hashed to detect input changes
 */
export function buildKey(feature, entityId, input) {
  return `${feature}_${entityId}_${contentHash(input)}`;
}

// ─── Core API ─────────────────────────────────────────────────────────────────
/**
 * Retrieve a cached entry. Returns null if missing or expired.
 */
export function get(key) {
  const entry = _store.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
    _store.delete(key);
    return null;
  }
  return entry;
}

/**
 * Store a result.
 * @param {string} key
 * @param {object} meta   { feature, entityType, entityId, model }
 * @param {*}      content  The value to cache
 * @param {number} [ttlMs]  Override TTL; defaults to CACHE_TTL[feature]
 */
export function set(key, meta, content, ttlMs) {
  const ttl = ttlMs ?? CACHE_TTL[meta.feature] ?? CACHE_TTL.default;
  const expiresAt = ttl === Infinity ? null : Date.now() + ttl;
  _store.set(key, {
    feature: meta.feature,
    entityType: meta.entityType ?? null,
    entityId: meta.entityId ?? null,
    model: meta.model ?? null,
    content,
    createdAt: new Date().toISOString(),
    expiresAt,
  });
}

/**
 * Invalidate a specific key or all keys matching a prefix.
 */
export function invalidate(keyOrPrefix) {
  for (const k of _store.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
      _store.delete(k);
    }
  }
}

/**
 * Invalidate all keys for which the predicate returns true.
 * Used by AIArtifactCache for entity-hash-based invalidation.
 * @param {(key: string) => boolean} predicate
 */
export function invalidateWhere(predicate) {
  for (const k of _store.keys()) {
    if (predicate(k)) _store.delete(k);
  }
}

/**
 * Sweep expired entries (call periodically from BackgroundJobRunner).
 */
export function sweep() {
  const now = Date.now();
  let removed = 0;
  for (const [k, v] of _store.entries()) {
    if (v.expiresAt !== null && now > v.expiresAt) {
      _store.delete(k);
      removed++;
    }
  }
  return removed;
}

/** Current entry count (for diagnostics). */
export function size() {
  return _store.size;
}

export const CacheService = { get, set, invalidate, invalidateWhere, sweep, size, buildKey, contentHash };
export default CacheService;
