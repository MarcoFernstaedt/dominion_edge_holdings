import express from 'express';
import { validate } from '../middleware/validate.js';
import { ConversationSchema, ConversationPatchSchema, ConversationTargetSchema } from '../../schemas/index.js';
import * as controller from '../controllers/conversations.controller.js';

const router = express.Router();

router.get('/api/conversations/kpi',             controller.getKpi);
router.get('/api/conversations/weekly-report',   controller.getWeeklyReport);
router.get('/api/conversations/trends',          controller.getTrends);
router.get('/api/conversations/pipeline-health', controller.getPipelineHealth);
router.get('/api/conversations/targets',         controller.getTargets);
router.patch('/api/conversations/targets',       validate(ConversationTargetSchema), controller.setTarget);
router.get('/api/conversations/agent-context',   controller.getAgentContext);
router.get('/api/conversations',                 controller.list);
router.post('/api/conversations',                validate(ConversationSchema),       controller.create);
router.patch('/api/conversations/:id',           validate(ConversationPatchSchema),  controller.update);
router.delete('/api/conversations/:id',          controller.remove);

export default router;
