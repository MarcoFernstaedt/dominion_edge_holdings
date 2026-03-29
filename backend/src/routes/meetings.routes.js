import express from 'express';
import { validate } from '../middleware/validate.js';
import { MeetingSchema } from '../../schemas/index.js';
import * as controller from '../controllers/meetings.controller.js';

const router = express.Router();

router.get('/api/meetings',                    controller.list);
router.post('/api/meetings',                   validate(MeetingSchema), controller.create);
router.get('/api/meetings/upcoming',           controller.listUpcoming);
router.get('/api/meetings/:id',                controller.getOne);
router.patch('/api/meetings/:id',              validate(MeetingSchema.partial()), controller.update);
router.post('/api/meetings/:id/confirm',       controller.confirm);
router.post('/api/meetings/:id/schedule',      controller.schedule);
router.post('/api/meetings/:id/complete',      controller.complete);
router.post('/api/meetings/:id/cancel',        controller.cancel);
router.post('/api/meetings/:id/generate-agenda', controller.generateAgenda);
router.get('/api/meetings/:id/prep',           controller.getPrep);
router.post('/api/meetings/:id/prep',          controller.buildPrep);
router.patch('/api/meetings/:id/prep',         validate(controller.updatePrepSchema), controller.updatePrep);
router.get('/api/meeting-prep/packets',        controller.listPrepPackets);

export default router;
