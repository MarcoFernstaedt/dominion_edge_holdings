import express from 'express';
import * as controller from '../controllers/sourcing.controller.js';

const router = express.Router();

// ─── Performance Systems ──────────────────────────────────────────────────────

router.get('/api/pipeline-pressure',        controller.getPipelinePressure);
router.get('/api/scoreboard',               controller.getScoreboard);
router.get('/api/deal-velocity',            controller.getDealVelocity);
router.get('/api/conversation-funnel',      controller.getConversationFunnel);
router.get('/api/frequency-progress',       controller.getFrequencyProgress);
router.post('/api/pipeline-pressure/scan',  controller.scanPipelinePressure);

// ─── Sourcing Radar routes ────────────────────────────────────────────────────

router.get('/api/sourcing-radar/adapters',              controller.listAdapters);
router.patch('/api/sourcing-radar/adapters/:id',        controller.patchAdapterValidate,  controller.patchAdapter);
router.post('/api/sourcing-radar/adapters/:id/health-check', controller.adapterHealthCheck);
router.post('/api/sourcing-radar/run',                  controller.runSourcingRadar);
router.get('/api/sourcing-radar/runs',                  controller.listSourcingRadarRuns);
router.get('/api/sourcing-radar/candidates',            controller.listCandidates);
router.patch('/api/sourcing-radar/candidates/:id',      controller.patchCandidateValidate, controller.patchCandidate);
router.post('/api/sourcing-radar/candidates/:id/accept', controller.acceptCandidate);
router.post('/api/sourcing-radar/import-csv',           controller.importCsvValidate,     controller.importCsv);

export default router;
