import express  from 'express';
import { validate }        from '../middleware/validate.js';
import { DocumentSchema, SettingsPatchSchema, ReplySuggestionSchema } from '../../schemas/index.js';
import * as controller from '../controllers/documents.controller.js';

const router = express.Router();

router.get('/api/documents',     controller.listDocuments);
router.post('/api/documents',    validate(DocumentSchema), controller.createDocument);
router.get('/api/documents/:id', controller.getDocument);

router.get('/api/reports/summary', controller.getReportSummary);

router.get('/api/settings',   controller.getSettings);
router.patch('/api/settings', validate(SettingsPatchSchema), controller.patchSettings);

router.post('/api/ai/reply-suggestion', validate(ReplySuggestionSchema), controller.aiReplySuggestion);

export default router;
