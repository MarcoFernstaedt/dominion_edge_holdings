/**
 * admin.routes.js — Operational visibility endpoints
 *
 * All routes are under /api/admin and protected by the global requireAuth
 * middleware applied to /api/* in app.js.
 */
import express from 'express';
import * as controller from '../controllers/admin.controller.js';

const router = express.Router();

// ── Job management ─────────────────────────────────────────────────────────────
router.get( '/api/admin/jobs',              controller.listJobs);
router.post('/api/admin/jobs/:id/trigger',  controller.triggerJob);
router.patch('/api/admin/jobs/:id',         controller.setJobEnabled);
router.get( '/api/admin/jobs/failures',     controller.listFailedRuns);

// ── Integration visibility ─────────────────────────────────────────────────────
router.get('/api/admin/integrations',         controller.listIntegrations);
router.get('/api/admin/integrations/health',  controller.integrationHealth);

export default router;
