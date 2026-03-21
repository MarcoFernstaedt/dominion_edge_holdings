import express from 'express';
import { validate, asyncRoute } from '../middleware/validate.js';
import { InteractionSchema }    from '../../schemas/index.js';
import * as controller          from '../controllers/interactions.controller.js';

const router = express.Router();

router.get('/api/interactions',                                      asyncRoute(controller.list));
router.post('/api/interactions', validate(InteractionSchema),        asyncRoute(controller.create));

export default router;
