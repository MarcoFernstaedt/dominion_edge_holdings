/**
 * auth.js — Authentication middleware scaffolding.
 *
 * Current mode: single-user token auth (opt-in via AUTH_ENABLED env var).
 * Upgrade path: replace verifyToken() with a full JWT/session check
 * and extend requireAuth to call a multi-user session store.
 *
 * To enable auth: set AUTH_ENABLED=true and SINGLE_USER_TOKEN=<secret> in .env
 */
import env from '../config/env.js';
import { errorResponse } from './errorResponse.js';

/**
 * Verify a bearer token against the configured single-user token.
 * @returns {boolean}
 */
function verifyToken(token) {
  if (!env.SINGLE_USER_TOKEN) return false;
  return token === env.SINGLE_USER_TOKEN;
}

/**
 * requireAuth — protect a route from unauthenticated access.
 *
 * When AUTH_ENABLED=false (default), passes all requests through so the app
 * behaves identically to the current single-user deployment.
 *
 * When AUTH_ENABLED=true, validates the Bearer token.
 */
export function requireAuth(req, res, next) {
  if (!env.AUTH_ENABLED) return next();

  const header = req.headers['authorization'] ?? '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token || !verifyToken(token)) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  // Attach a minimal identity object — extend this when multi-user is added
  req.user = { id: env.SYSTEM_USER_ID ?? 'single-user', role: 'owner' };
  next();
}

/**
 * optionalAuth — parses auth if present but never rejects.
 * Useful for routes that behave differently when authenticated.
 */
export function optionalAuth(req, res, next) {
  if (!env.AUTH_ENABLED) {
    req.user = { id: env.SYSTEM_USER_ID ?? 'single-user', role: 'owner' };
    return next();
  }

  const header = req.headers['authorization'] ?? '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (token && verifyToken(token)) {
    req.user = { id: env.SYSTEM_USER_ID ?? 'single-user', role: 'owner' };
  }
  next();
}
