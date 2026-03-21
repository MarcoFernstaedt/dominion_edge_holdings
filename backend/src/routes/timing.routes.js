import express from 'express';
import * as controller from '../controllers/timing.controller.js';

const router = express.Router();

router.post('/api/timing/summary',                        controller.timingSummary);
router.post('/api/timing/alerts',                         controller.timingAlerts);
router.get('/api/timing/thresholds',                      controller.getThresholds);
router.post('/api/timing/entity/:entityType/:id',         controller.timingEntity);
router.post('/api/recovery/generate',                     controller.generateRecovery);
router.post('/api/recovery/apply-task-pack',              controller.applyRecoveryTaskPackValidate, controller.applyRecoveryTaskPack);

export default router;
