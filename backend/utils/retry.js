/**
 * Retry utility — exponential backoff with jitter.
 *
 * Per spec: max retries = 3, retry delay = exponential backoff.
 * Never used for operations that risk data corruption (those abort immediately).
 */

/**
 * Execute an async function with retries.
 *
 * @param {Function} fn           Async function to call; should throw on failure
 * @param {object}  [opts]
 * @param {number}  [opts.maxRetries=3]     Max attempts after initial failure
 * @param {number}  [opts.baseDelayMs=500]  Base delay before first retry
 * @param {number}  [opts.maxDelayMs=8000]  Cap on delay
 * @param {Function} [opts.shouldRetry]     (err) → bool; return false to abort early
 * @param {Function} [opts.onRetry]         (attempt, err, delayMs) → void; for logging
 * @returns {Promise<*>}
 */
export async function withRetry(fn, opts = {}) {
  const {
    maxRetries   = 3,
    baseDelayMs  = 500,
    maxDelayMs   = 8000,
    shouldRetry  = () => true,
    onRetry      = null,
  } = opts;

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries) break;
      if (!shouldRetry(err))      break;

      // Exponential backoff with ±20% jitter
      const exp    = baseDelayMs * Math.pow(2, attempt);
      const jitter = exp * 0.2 * (Math.random() * 2 - 1);
      const delay  = Math.min(Math.round(exp + jitter), maxDelayMs);

      if (onRetry) onRetry(attempt + 1, err, delay);
      await sleep(delay);
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap a function so it aborts (does not retry) on critical errors.
 * Use for operations that could cause data corruption if partially executed.
 */
export function criticalGuard(fn, { onAbort } = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (onAbort) onAbort(err);
      throw Object.assign(err, { critical: true, aborted: true });
    }
  };
}

export default { withRetry, criticalGuard };
