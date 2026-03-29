/**
 * auth.controller.js
 *
 * Handles login, logout, session check, and first-run setup.
 *
 * Cookie settings:
 *   - httpOnly: true   (not readable by JS)
 *   - secure: isProd   (HTTPS only in production)
 *   - sameSite: 'lax'  (CSRF protection for navigation requests)
 *   - path: '/'
 *   - maxAge: 7 days
 */

import bcrypt from 'bcryptjs';
import jwt    from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import env    from '../config/env.js';
import { errorResponse } from '../middleware/errorResponse.js';
import AuditLogService from '../../services/AuditLogService.js';
import logger from '../lib/logger.js';

const COOKIE_NAME    = 'deh_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// ─── Cookie factory ───────────────────────────────────────────────────────────

function cookieOptions() {
  return {
    httpOnly: true,
    secure:   env.isProd,
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  };
}

function signToken(user) {
  if (!env.AUTH_JWT_SECRET) {
    throw new Error('AUTH_JWT_SECRET is not configured');
  }
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role ?? 'owner' },
    env.AUTH_JWT_SECRET,
    { expiresIn: env.AUTH_JWT_EXPIRES_IN || '7d' }
  );
}

function safeUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role ?? 'owner', avatarUrl: user.avatarUrl ?? null };
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function login(req, res) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', 'email and password are required');
  }

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  } catch (err) {
    logger.error({ err: err.message }, '[auth/login] DB error');
    return errorResponse(res, 503, 'SERVICE_UNAVAILABLE', 'Authentication service temporarily unavailable');
  }

  // Constant-time response to avoid user enumeration
  const dummyHash = '$2a$12$invalidhashpaddingtoensureconstanttimexyz';
  const hash      = user?.passwordHash ?? dummyHash;
  const valid     = await bcrypt.compare(password, hash);

  if (!user || !valid || !user.passwordHash) {
    return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  AuditLogService.log(AuditLogService.AUDIT_EVENTS.AUTH_LOGIN, 'user', user.id, { email: user.email, role: user.role }, user.id);
  res.json({ user: safeUser(user) });
}

/**
 * POST /api/auth/logout
 */
export function logout(req, res) {
  if (req.user?.id && req.user.id !== 'single-user') {
    AuditLogService.log(AuditLogService.AUDIT_EVENTS.AUTH_LOGOUT, 'user', req.user.id, {}, req.user.id);
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */
export async function me(req, res) {
  if (!req.user) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Not authenticated');
  }

  // In bypass mode (dev without AUTH_ENABLED), return synthetic identity
  if (req.user.id === 'single-user' || !req.user.email) {
    return res.json({
      user: {
        id:       req.user.id,
        email:    null,
        name:     'Operator',
        role:     req.user.role,
        avatarUrl: null,
      },
    });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return errorResponse(res, 401, 'UNAUTHORIZED', 'User not found');
  res.json({ user: safeUser(user) });
}

/**
 * POST /api/auth/setup
 * First-run: creates the owner account. Only works when zero users exist.
 * Body: { email, password, name }
 */
export async function setup(req, res) {
  const count = await prisma.user.count();
  if (count > 0) {
    return errorResponse(res, 403, 'SETUP_COMPLETE', 'Setup has already been completed');
  }

  const { email, password, name } = req.body ?? {};
  if (!email || !password || !name) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', 'email, password, and name are required');
  }
  if (password.length < 12) {
    return errorResponse(res, 400, 'PASSWORD_TOO_SHORT', 'Password must be at least 12 characters');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name:  name.trim(),
      passwordHash,
      role:  'owner',
    },
  });

  // Auto-login after setup
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  AuditLogService.log(AuditLogService.AUDIT_EVENTS.AUTH_SETUP, 'user', user.id, { email: user.email, role: user.role }, user.id);
  res.status(201).json({ user: safeUser(user) });
}

/**
 * POST /api/auth/refresh
 * Reissues a fresh JWT using the existing valid cookie.
 * Useful for extending sessions before they expire.
 */
export async function refresh(req, res) {
  if (!req.user?.id || req.user.id === 'single-user') {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Not authenticated');
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return errorResponse(res, 401, 'UNAUTHORIZED', 'User not found');

  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ user: safeUser(user) });
}

/**
 * GET /api/auth/status
 * Returns whether the auth system is configured (for frontend first-run detection).
 * Never exposes secrets.
 */
export async function authStatus(_req, res) {
  const userCount = await prisma.user.count().catch(() => -1);
  res.json({
    authEnabled:  env.isProd || env.AUTH_ENABLED,
    jwtConfigured: !!(env.AUTH_JWT_SECRET),
    setupRequired: userCount === 0,
    userCount:     userCount >= 0 ? userCount : null,
  });
}
