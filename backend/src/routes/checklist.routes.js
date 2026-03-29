import express        from 'express';
import * as controller from '../controllers/checklist.controller.js';

const router = express.Router();

router.get('/api/checklist',                              controller.listChecklist);
router.patch('/api/checklist/items/:itemId/complete',     controller.completeChecklistItem);
router.post('/api/checklist/grade',                       controller.gradeSubmissionValidate, controller.gradeSubmission);

export default router;
