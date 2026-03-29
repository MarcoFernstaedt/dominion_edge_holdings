import express    from 'express';
import * as controller from '../controllers/dashboard.controller.js';

const router = express.Router();

router.get('/api/dashboard/metrics',      controller.getMetrics);
router.get('/api/dashboard/next-actions', controller.getNextActions);
router.get('/api/dashboard/briefing',     controller.getBriefing);
router.get('/api/dashboard/system-status', controller.getSystemStatus);

export default router;
