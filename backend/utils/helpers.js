/**
 * Shared utility helpers for the backend.
 */

/**
 * Generate a short unique ID.
 */
export function generateId(prefix = '') {
  const ts  = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 7);
  return prefix ? `${prefix}_${ts}${rnd}` : `${ts}${rnd}`;
}

/**
 * Returns today's date as YYYY-MM-DD.
 */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Truncate a string to maxLen, appending '…' if truncated.
 */
export function truncate(str, maxLen = 200) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

export default { generateId, todayISO, clamp, truncate };
