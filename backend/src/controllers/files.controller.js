/**
 * files.controller.js
 *
 * Handles file upload/download via S3-compatible object storage.
 * Generates presigned URLs — files go directly browser → S3, never through the API server.
 * File metadata is persisted in the StoredFile DB model.
 */

import prisma from '../lib/prisma.js';
import { S3StorageProvider } from '../../services/providers/S3StorageProvider.js';
import IntegrationRegistry from '../../services/IntegrationRegistry.js';
import logger from '../lib/logger.js';

// ─── List stored files ────────────────────────────────────────────────────────

const ALLOWED_ENTITY_TYPES = ['deal', 'company', 'contact', 'artifact', 'diligence', 'meeting', 'document'];

export async function listFiles(req, res) {
  const { entityType, entityId } = req.query;

  const rawLimit  = parseInt(req.query.limit,  10);
  const rawOffset = parseInt(req.query.offset, 10);
  const safeLimit  = Number.isNaN(rawLimit)  ? 50 : Math.min(Math.max(rawLimit, 1), 100);
  const safeOffset = Number.isNaN(rawOffset) ? 0  : Math.max(rawOffset, 0);

  if (entityType && !ALLOWED_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ error: 'Invalid entityType', code: 'VALIDATION_ERROR' });
  }

  const where = {};
  if (entityType) where.entityType = entityType;
  if (entityId)   where.entityId   = entityId;

  const [files, total] = await Promise.all([
    prisma.storedFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    safeLimit,
      skip:    safeOffset,
    }),
    prisma.storedFile.count({ where }),
  ]);

  res.json({ files, total, limit: safeLimit, offset: safeOffset });
}

// ─── Request presigned upload URL ────────────────────────────────────────────

export async function requestUpload(req, res) {
  const guard = IntegrationRegistry.guard('storage');
  if (!guard.ok) {
    return res.status(503).json({ error: guard.degradedMessage, code: guard.reason });
  }

  const { originalName, mimeType, entityType, entityId, metadata } = req.body;

  if (!originalName) {
    return res.status(400).json({ error: 'originalName is required' });
  }

  const key = S3StorageProvider.buildKey(entityType, entityId, originalName);

  const { uploadUrl, bucket, expiresAt } = await S3StorageProvider.getPresignedUploadUrl({
    key,
    mimeType: mimeType || 'application/octet-stream',
    expiresInSeconds: 900, // 15 minutes
  });

  // Pre-create the StoredFile record so the client has an ID to confirm later
  const file = await prisma.storedFile.create({
    data: {
      bucket,
      key,
      originalName,
      mimeType:   mimeType || null,
      entityType: entityType || null,
      entityId:   entityId   || null,
      uploadedBy: req.user?.id || req.headers['x-user-id'] || null,
      metadata:   metadata   || null,
      expiresAt:  null,
    },
  });

  res.json({ fileId: file.id, uploadUrl, key, bucket, expiresAt });
}

// ─── Confirm upload complete ──────────────────────────────────────────────────

export async function confirmUpload(req, res) {
  const { id } = req.params;
  const { sizeBytes } = req.body;

  const file = await prisma.storedFile.update({
    where: { id },
    data:  { sizeBytes: sizeBytes ? parseInt(sizeBytes, 10) : null },
  });

  res.json({ file });
}

// ─── Get presigned download URL ───────────────────────────────────────────────

export async function getDownloadUrl(req, res) {
  const { id } = req.params;

  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return res.status(404).json({ error: 'File not found' });

  const guard = IntegrationRegistry.guard('storage');
  if (!guard.ok) {
    return res.status(503).json({ error: guard.degradedMessage, code: guard.reason });
  }

  const { downloadUrl, expiresAt } = await S3StorageProvider.getPresignedDownloadUrl({
    key:          file.key,
    expiresInSeconds: 3600,
    downloadName: file.originalName,
  });

  res.json({ downloadUrl, expiresAt, file });
}

// ─── Get file metadata ────────────────────────────────────────────────────────

export async function getFile(req, res) {
  const { id } = req.params;
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json({ file });
}

// ─── Delete file ──────────────────────────────────────────────────────────────

export async function deleteFile(req, res) {
  const { id } = req.params;

  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return res.status(404).json({ error: 'File not found' });

  const guard = IntegrationRegistry.guard('storage');
  if (guard.ok) {
    try {
      await S3StorageProvider.deleteObject(file.key);
    } catch (err) {
      // Log but don't block DB deletion
      logger.warn({ err: err.message }, '[files] S3 delete failed — DB record still removed');
    }
  }

  await prisma.storedFile.delete({ where: { id } });
  res.json({ deleted: true, id });
}

// ─── Storage status ───────────────────────────────────────────────────────────

export function getStorageStatus(req, res) {
  const status    = IntegrationRegistry.getStatus('storage');
  const cfg       = IntegrationRegistry.getConfig('storage');
  const isReady   = IntegrationRegistry.guard('storage').ok;

  res.json({
    status:    status.status,
    enabled:   cfg.enabled,
    bucket:    cfg.bucket,
    region:    cfg.region,
    endpoint:  cfg.endpoint || null,
    hasKey:    cfg.hasKey,
    ready:     isReady,
    lastCheck: status.lastHealthCheck,
    lastError: status.lastError,
  });
}
