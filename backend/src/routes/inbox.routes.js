import express    from 'express';
import { validate } from '../middleware/validate.js';
import { ComposeSchema, OutreachGenerateSchema } from '../../schemas/index.js';
import * as controller from '../controllers/inbox.controller.js';

const router = express.Router();

router.get('/api/inbox/threads',     controller.listThreads);
router.get('/api/inbox/threads/:id', controller.getThread);
router.post('/api/inbox/compose',    validate(ComposeSchema), controller.compose);

router.get('/api/outreach/templates',                                    controller.listOutreachTemplates);
router.post('/api/outreach/generate', validate(OutreachGenerateSchema), controller.generateOutreach);

export default router;
