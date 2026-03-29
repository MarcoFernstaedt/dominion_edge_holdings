import express from 'express';
import * as controller from '../controllers/integrations.controller.js';

const router = express.Router();

router.get('/api/integrations',                       controller.listIntegrations);
router.get('/api/integrations/:name',                 controller.getIntegration);
router.patch('/api/integrations/:name',               controller.patchIntegrationValidate, controller.patchIntegration);
router.post('/api/integrations/:name/test',           controller.testIntegration);
router.post('/api/integrations/health/check-all',     controller.checkAllHealth);

// ─── Velocity Intelligence ────────────────────────────────────────────────────

router.get('/api/velocity',                           controller.getVelocity);
router.get('/api/velocity/trend',                     controller.getVelocityTrend);

export default router;
