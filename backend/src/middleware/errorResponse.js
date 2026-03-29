import env from '../config/env.js';

/**
 * Produces a sanitised error response — never leaks internals in production.
 * Use this everywhere instead of res.status(x).json({ error: ... }).
 */
export function errorResponse(res, status, code, message, details = undefined) {
  const body = { error: { code, message, requestId: res.req?.id } };
  if (!env.isProd && details !== undefined) {
    body.error.details = details;
  }
  return res.status(status).json(body);
}
