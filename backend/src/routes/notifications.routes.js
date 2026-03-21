import express from 'express';
import * as controller from '../controllers/notifications.controller.js';

const router = express.Router();

// ─── Notifications ────────────────────────────────────────────────────────────

router.get('/api/notifications',                   controller.list);
router.post('/api/notifications/:id/read',         controller.markRead);
router.post('/api/notifications/:id/dismiss',      controller.dismiss);
router.post('/api/notifications/mark-all-read',    controller.markAllRead);

// ─── Quick actions ────────────────────────────────────────────────────────────

router.post('/api/quick-log',                              ...controller.quickLog);
router.post('/api/quick-action/next-action/open',          ...controller.openNextAction);
router.post('/api/quick-action/proof-submit',              ...controller.proofSubmit);
router.post('/api/quick-action/approve-and-send',          ...controller.approveAndSend);

// ─── Exports ──────────────────────────────────────────────────────────────────

router.get('/api/exports',              controller.listExports);
router.get('/api/exports/:id',          controller.getExport);
router.get('/api/exports/:id/audit',    controller.getExportAudit);
router.post('/api/exports/:id/complete', ...controller.completeExport);
router.post('/api/exports/:id/cancel',   ...controller.cancelExport);

export default router;
