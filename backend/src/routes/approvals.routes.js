import express from 'express';
import * as controller from '../controllers/approvals.controller.js';

const router = express.Router();

// ─── Approval routes ──────────────────────────────────────────────────────────

router.get('/api/approvals',                controller.listApprovals);
router.get('/api/approvals/:id',            controller.getApproval);
router.get('/api/approvals/:id/history',    controller.getApprovalHistory);
router.get('/api/approvals/:id/staleness',  controller.getApprovalStaleness);
router.post('/api/approvals/:id/submit',    controller.submitApproval);
router.post('/api/approvals/:id/approve',   controller.approveApprovalValidate, controller.approveApproval);
router.post('/api/approvals/:id/reject',    controller.rejectApprovalValidate,  controller.rejectApproval);
router.post('/api/approvals/:id/revise',    controller.reviseApprovalValidate,  controller.reviseApproval);
router.post('/api/approvals/:id/apply',     controller.applyApproval);

// ─── Artifact routes ──────────────────────────────────────────────────────────

router.get('/api/artifacts',                controller.listArtifacts);
router.post('/api/artifacts',               controller.createArtifactValidate,   controller.createArtifact);
router.get('/api/artifacts/:id',            controller.getArtifact);
router.get('/api/artifacts/:id/summary',    controller.getArtifactSummary);
router.get('/api/artifacts/:id/versions',   controller.getArtifactVersions);
router.get('/api/artifacts/:id/staleness',  controller.getArtifactStaleness);
router.post('/api/artifacts/:id/mark-sent', controller.markArtifactSent);
router.post('/api/artifacts/generate',      controller.generateArtifactValidate, controller.generateArtifact);
router.post('/api/artifacts/:id/regenerate',controller.regenerateArtifact);
router.post('/api/artifacts/:id/archive',   controller.archiveArtifactValidate,  controller.archiveArtifact);
router.post('/api/artifacts/:id/export',    controller.exportArtifactValidate,   controller.exportArtifact);

export default router;
