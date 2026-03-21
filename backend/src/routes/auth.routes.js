/**
 * auth.routes.js — Public authentication endpoints.
 * These routes are mounted BEFORE the global requireAuth guard.
 */

import express from 'express';
import { z }   from 'zod';
import { validate }  from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as controller from '../controllers/auth.controller.js';

const router = express.Router();

// ─── Public (no auth required) ────────────────────────────────────────────────
router.get ('/api/auth/status',  controller.authStatus);
router.post('/api/auth/login',
  validate(z.object({
    email:    z.string().email().max(254),
    password: z.string().min(1).max(256),
  })),
  controller.login
);
router.post('/api/auth/setup',
  validate(z.object({
    email:    z.string().email().max(254),
    password: z.string().min(12).max(256),
    name:     z.string().min(1).max(100),
  })),
  controller.setup
);

// ─── Authenticated ────────────────────────────────────────────────────────────
router.get ('/api/auth/me',      requireAuth, controller.me);
router.post('/api/auth/logout',  requireAuth, controller.logout);
router.post('/api/auth/refresh', requireAuth, controller.refresh);

export default router;
