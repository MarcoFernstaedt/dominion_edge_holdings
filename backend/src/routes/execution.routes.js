import express from 'express';
import * as controller from '../controllers/execution.controller.js';

const router = express.Router();

router.get('/api/execution/summary',          controller.getExecutionSummary);
router.get('/api/execution/pipeline-health',  controller.getPipelineHealth);
router.get('/api/execution/targets',          controller.getTargets);
router.patch('/api/execution/targets',        controller.setTargets);
router.get('/api/execution/target-completion', controller.getTargetCompletion);
router.get('/api/execution/daily',            controller.getDaily);
router.get('/api/execution/daily/history',    controller.getDailyHistory);
router.post('/api/execution/daily',           controller.recordDailyActivity);
router.get('/api/execution/weekly',           controller.getWeekly);
router.post('/api/execution/weekly',          controller.updateWeekly);
router.get('/api/execution/monthly',          controller.getMonthly);
router.post('/api/execution/monthly',         controller.updateMonthly);
router.get('/api/execution/pipeline',         controller.getPipeline);
router.get('/api/execution/board',            controller.getBoard);
router.get('/api/execution/investors',        controller.getInvestors);
router.get('/api/execution/deal-momentum',    controller.getDealMomentum);
router.get('/api/execution/alerts',           controller.getAlerts);

export default router;
