import express from 'express';
import { validate, asyncRoute } from '../middleware/validate.js';
import { TaskSchema } from '../../schemas/index.js';
import * as controller from '../controllers/tasks.controller.js';

const router = express.Router();

router.get('/api/tasks',       asyncRoute(controller.list));
router.post('/api/tasks',      validate(TaskSchema), asyncRoute(controller.create));
router.patch('/api/tasks/:id', validate(TaskSchema.partial()), asyncRoute(controller.update));
router.delete('/api/tasks/:id', asyncRoute(controller.remove));

export default router;
