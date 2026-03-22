import express from 'express';
import * as controller from '../controllers/health.controller.js';

const router = express.Router();

// Kubernetes-style probes (public — no auth)
router.get('/healthz',          controller.liveness);
router.get('/readyz',           controller.readiness);

// Legacy paths (keep for compatibility)
router.get('/health',           controller.healthCheck);
router.get('/api/health',       controller.healthCheck);

export default router;
