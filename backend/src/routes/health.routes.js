import express from 'express';
import * as controller from '../controllers/health.controller.js';

const router = express.Router();

router.get('/health',     controller.healthCheck);
router.get('/api/health', controller.healthCheck);

export default router;
