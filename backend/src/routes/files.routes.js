import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as controller from '../controllers/files.controller.js';

const router = express.Router();

// ─── Storage status ───────────────────────────────────────────────────────────
router.get('/api/storage/status', controller.getStorageStatus);

// ─── File CRUD ────────────────────────────────────────────────────────────────
router.get('/api/files',     controller.listFiles);
router.get('/api/files/:id', controller.getFile);

// ─── Upload flow: request presigned URL → upload directly → confirm ───────────
router.post('/api/files/upload-url',
  validate(z.object({
    originalName: z.string().min(1).max(255),
    mimeType:     z.string().max(100).optional(),
    entityType:   z.string().max(50).optional(),
    entityId:     z.string().max(50).optional(),
    metadata:     z.record(z.unknown()).optional(),
  })),
  controller.requestUpload
);

router.post('/api/files/:id/confirm',
  validate(z.object({ sizeBytes: z.number().int().positive().optional() })),
  controller.confirmUpload
);

// ─── Download ─────────────────────────────────────────────────────────────────
router.get('/api/files/:id/download-url', controller.getDownloadUrl);

// ─── Delete ───────────────────────────────────────────────────────────────────
router.delete('/api/files/:id', controller.deleteFile);

export default router;
