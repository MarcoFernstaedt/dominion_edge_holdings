/**
 * auth.js — Production JWT authentication middleware.
 *
 * Token sources (in priority order):
 *   1. HttpOnly cookie: deh_token  (web clients)
 *   2. Authorization: Bearer <jwt> header  (API clients / tests)
 *
 * Auth enforcement:
 *   - NODE_ENV=production  → always required
 *   - AUTH_ENABLED=true     → required in dev/test too
 *   - otherwise             → bypassed (req.user set to system identity)
 *
 * Upgrade path to multi-user:
 *   - User record already has `id`, `role`, `email`
 *   - Just add more users to the DB; JWT validation is identical
 *   - Role-based middleware can be layered on top of requireAuth
 */

import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { errorResponse } from './errorResponse.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAuthEnforced() {
  return env.isProd || env.AUTH_ENABLED;
}

function extractToken(req) {
  // 1. HttpOnly cookie (set by /api/auth/login)
  if (req.cookies?.deh_token) return req.cookies.deh_token;

  // 2. Bearer header (API clients, supertest tests when auth is explicitly tested)
  const header = req.headers['authorization'] ?? '';
  if (header.startsWith('Bearer ')) return header.slice(7);

  return null;
}

function verifyToken(token) {
  if (!env.AUTH_JWT_SECRET) {
    throw Object.assign(new Error('AUTH_JWT_SECRET is not set'), { code: 'SERVER_MISCONFIGURED' });
  }
  return jwt.verify(token, env.AUTH_JWT_SECRET);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * requireAuth — protect a route from unauthenticated access.
 *
 * When auth is not enforced (dev/test without AUTH_ENABLED), passes all
 * requests through with a system identity attached to req.user.
 */
export function requireAuth(req, res, next) {
  if (!isAuthEnforced()) {
    req.user = {
      id:    env.SYSTEM_USER_ID ?? 'single-user',
      role:  'owner',
      email: null,
    };
    return next();
  }

  if (!env.AUTH_JWT_SECRET) {
    return errorResponse(res, 503, 'SERVER_MISCONFIGURED', 'Auth is enabled but AUTH_JWT_SECRET is not set.');
  }

  const token = extractToken(req);
  if (!token) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id:    payload.sub,
      role:  payload.role  ?? 'owner',
      email: payload.email ?? null,
    };
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return errorResponse(res, 401, code, 'Session expired — please log in again');
  }
}

/**
 * optionalAuth — sets req.user if a valid token is present, never rejects.
 * Useful for routes that behave differently when authenticated vs anonymous.
 */
export function optionalAuth(req, res, next) {
  if (!isAuthEnforced()) {
    req.user = {
      id:    env.SYSTEM_USER_ID ?? 'single-user',
      role:  'owner',
      email: null,
    };
    return next();
  }

  const token = extractToken(req);
  if (token) {
    try {
      const payload = verifyToken(token);
      req.user = { id: payload.sub, role: payload.role ?? 'owner', email: payload.email ?? null };
    } catch {
      // Invalid/expired token — treat as anonymous
    }
  }
  next();
}

/**
 * requireRole — layer on top of requireAuth to enforce minimum role.
 * Call after requireAuth.
 *
 * @param {...string} roles  Allowed roles (e.g. 'owner', 'admin')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 403, 'FORBIDDEN', 'Insufficient permissions');
    }
    next();
  };
}
