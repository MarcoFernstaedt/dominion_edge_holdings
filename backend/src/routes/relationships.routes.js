import express from 'express';
import { validate } from '../middleware/validate.js';
import {
  RelationshipSchema, RelationshipPatchSchema,
  RelationshipInteractionSchema, ScheduleFollowUpSchema,
} from '../../schemas/index.js';
import * as controller from '../controllers/relationships.controller.js';

const router = express.Router();

router.get('/api/relationships/dashboard',          controller.getDashboard);
router.get('/api/relationships',                    controller.list);
router.get('/api/relationships/execution-counts',   controller.getExecutionCounts);
router.get('/api/relationships/generate-tasks',     controller.generateTasks);
router.post('/api/relationships/generate-tasks',    controller.generateTasks);
router.get('/api/relationships/:id',                controller.getOne);
router.post('/api/relationships',                   validate(RelationshipSchema),            controller.create);
router.patch('/api/relationships/:id',              validate(RelationshipPatchSchema),       controller.update);
router.delete('/api/relationships/:id',             controller.remove);
router.get('/api/relationships/:id/interactions',   controller.getInteractions);
router.post('/api/relationships/:id/interactions',  validate(RelationshipInteractionSchema), controller.logInteraction);
router.patch('/api/relationships/:id/interest-level', controller.updateInterestLevel);
router.post('/api/relationships/:id/schedule-followup', validate(ScheduleFollowUpSchema),   controller.scheduleFollowup);

export default router;
