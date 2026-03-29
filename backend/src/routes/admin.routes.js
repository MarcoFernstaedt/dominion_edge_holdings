/**
 * admin.routes.js — Operational visibility endpoints
 *
 * All routes are under /api/admin and protected by:
 *   1. Global requireAuth middleware applied to /api/* in app.js
 *   2. requireRole('owner') — only the owner/admin can access admin endpoints
 */
import express from 'express';
import { requireRole } from '../middleware/auth.js';
import * as controller from '../controllers/admin.controller.js';

const router = express.Router();

// All admin routes require owner role (already authenticated by global guard)
router.use('/api/admin', requireRole('owner', 'admin'));

// ── Job management ─────────────────────────────────────────────────────────────
router.get( '/api/admin/jobs',              controller.listJobs);
router.post('/api/admin/jobs/:id/trigger',  controller.triggerJob);
router.patch('/api/admin/jobs/:id',         controller.setJobEnabled);
router.get( '/api/admin/jobs/failures',     controller.listFailedRuns);

// ── Integration visibility ─────────────────────────────────────────────────────
router.get('/api/admin/integrations',         controller.listIntegrations);
router.get('/api/admin/integrations/health',  controller.integrationHealth);

export default router;
