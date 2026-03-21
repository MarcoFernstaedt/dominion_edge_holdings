import express from 'express';
import * as controller from '../controllers/playbook.controller.js';

const router = express.Router();

router.get('/api/playbook/summary',               controller.getPlaybookSummary);
router.get('/api/playbook/stages',                controller.getStages);
router.get('/api/playbook/current',               controller.getCurrentStage);
router.get('/api/playbook/stages/:id',            controller.getStage);
router.get('/api/playbook/next-tasks',            controller.getNextTasks);
router.post('/api/playbook/tasks/:id/complete',   controller.completeTask);
router.patch('/api/playbook/tasks/:id/status',    controller.updateTaskStatus);
router.get('/api/playbook/today',                 controller.getToday);
router.post('/api/playbook/sync',                 controller.syncPlaybook);
router.get('/api/playbook/progress',              controller.getProgress);

export default router;
