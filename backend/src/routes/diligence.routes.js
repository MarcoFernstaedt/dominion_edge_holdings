/**
 * diligence.routes.js
 *
 * Routes mounted at /api/diligence (all behind requireAuth in app.js).
 */

import { Router } from 'express';
import {
  listDocuments,
  linkDocumentHandler,
  getDocument,
  reprocessDocument,
  listFindings,
  updateFinding,
  getSummary,
  synthesize,
  getQuestions,
  getDocumentTypes,
} from '../controllers/diligence.controller.js';

const router = Router();

// ── Meta ───────────────────────────────────────────────────────────────────────
router.get('/document-types', getDocumentTypes);

// ── Deal-scoped ────────────────────────────────────────────────────────────────
router.get( '/:dealId/documents',              listDocuments);
router.post('/:dealId/documents',              linkDocumentHandler);
router.get( '/:dealId/documents/:docId',       getDocument);
router.post('/:dealId/documents/:docId/reprocess', reprocessDocument);

router.get(  '/:dealId/findings',     listFindings);
router.patch('/:dealId/findings/:id', updateFinding);

router.get( '/:dealId/summary',            getSummary);
router.post('/:dealId/summary/synthesize', synthesize);
router.get( '/:dealId/questions',          getQuestions);

export default router;
