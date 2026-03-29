import express from 'express';
import { validate, asyncRoute } from '../middleware/validate.js';
import { DealSchema } from '../../schemas/index.js';
import * as controller from '../controllers/deals.controller.js';

const router = express.Router();

router.get('/api/deals',                              asyncRoute(controller.list));
router.post('/api/deals',                             validate(DealSchema), asyncRoute(controller.create));
router.get('/api/deals/:id',                          controller.getOne);
router.patch('/api/deals/:id',                        validate(DealSchema.partial()), asyncRoute(controller.update));
router.get('/api/deals/:id/probability',              controller.getProbability);
router.post('/api/deals/:id/probability/refresh',     controller.refreshProbability);
router.post('/api/deals/probability/refresh-all',     controller.refreshAllProbabilities);
router.get('/api/dashboard/probability-summary',      controller.probabilitySummary);
router.get('/api/dashboard/sourcing-summary',         controller.sourcingSummary);
router.get('/api/dashboard/prep-summary',             controller.prepSummary);

export default router;
