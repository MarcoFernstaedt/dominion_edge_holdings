/**
 * S3StorageProvider
 *
 * S3-compatible object storage provider using @aws-sdk/client-s3 and
 * @aws-sdk/s3-request-presigner for presigned upload/download URLs.
 *
 * Works with AWS S3, Cloudflare R2, MinIO, Backblaze B2, and any
 * S3-compatible provider.
 *
 * Required env vars:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET
 * Optional:
 *   S3_REGION (default: us-east-1)
 *   S3_ENDPOINT (for non-AWS providers)
 *   S3_FORCE_PATH_STYLE (required for MinIO — set to "true")
 */

import env from '../../src/config/env.js';

// ─── Config validation ────────────────────────────────────────────────────────

export function isConfigured() {
  return !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.S3_BUCKET);
}

export function validateConfig() {
  const missing = [];
  if (!env.AWS_ACCESS_KEY_ID)     missing.push('AWS_ACCESS_KEY_ID');
  if (!env.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  if (!env.S3_BUCKET)             missing.push('S3_BUCKET');
  return { valid: missing.length === 0, missing };
}

// ─── Lazy S3 client factory ───────────────────────────────────────────────────

let _s3Client = null;

async function getS3Client() {
  if (_s3Client) return _s3Client;

  let S3Client;
  try {
    ({ S3Client } = await import('@aws-sdk/client-s3'));
  } catch {
    throw new Error('@aws-sdk/client-s3 is not installed. Run: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner');
  }

  const config = {
    region:      env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId:     env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  };

  if (env.S3_ENDPOINT) {
    config.endpoint        = env.S3_ENDPOINT;
    config.forcePathStyle  = env.S3_FORCE_PATH_STYLE;
  }

  _s3Client = new S3Client(config);
  return _s3Client;
}

// ─── Key strategy ─────────────────────────────────────────────────────────────

/**
 * Build a deterministic storage key for a given entity and file.
 * Format: {entityType}/{entityId}/{timestamp}-{filename}
 */
export function buildKey(entityType, entityId, originalName) {
  const ts   = Date.now();
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  if (entityType && entityId) {
    return `${entityType}/${entityId}/${ts}-${safe}`;
  }
  return `uploads/${ts}-${safe}`;
}

// ─── Upload / Download ────────────────────────────────────────────────────────

/**
 * Generate a presigned PUT URL for direct browser → S3 upload.
 * @param {{ key: string, mimeType?: string, expiresInSeconds?: number }} opts
 * @returns {{ uploadUrl: string, key: string, bucket: string, expiresAt: string }}
 */
export async function getPresignedUploadUrl({ key, mimeType = 'application/octet-stream', expiresInSeconds = 900 } = {}) {
  const [s3, { PutObjectCommand }, { getSignedUrl }] = await Promise.all([
    getS3Client(),
    import('@aws-sdk/client-s3').then((m) => ({ PutObjectCommand: m.PutObjectCommand })),
    import('@aws-sdk/s3-request-presigner').then((m) => ({ getSignedUrl: m.getSignedUrl })),
  ]);

  const command = new PutObjectCommand({
    Bucket:      env.S3_BUCKET,
    Key:         key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  return { uploadUrl, key, bucket: env.S3_BUCKET, expiresAt };
}

/**
 * Generate a presigned GET URL for secure file download.
 * @param {{ key: string, expiresInSeconds?: number, downloadName?: string }} opts
 * @returns {{ downloadUrl: string, key: string, expiresAt: string }}
 */
export async function getPresignedDownloadUrl({ key, expiresInSeconds = 3600, downloadName } = {}) {
  const [s3, { GetObjectCommand }, { getSignedUrl }] = await Promise.all([
    getS3Client(),
    import('@aws-sdk/client-s3').then((m) => ({ GetObjectCommand: m.GetObjectCommand })),
    import('@aws-sdk/s3-request-presigner').then((m) => ({ getSignedUrl: m.getSignedUrl })),
  ]);

  const params = {
    Bucket: env.S3_BUCKET,
    Key:    key,
  };
  if (downloadName) {
    params.ResponseContentDisposition = `attachment; filename="${downloadName}"`;
  }

  const command    = new GetObjectCommand(params);
  const downloadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  const expiresAt   = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  return { downloadUrl, key, expiresAt };
}

/**
 * Delete an object from S3.
 */
export async function deleteObject(key) {
  const [s3, { DeleteObjectCommand }] = await Promise.all([
    getS3Client(),
    import('@aws-sdk/client-s3').then((m) => ({ DeleteObjectCommand: m.DeleteObjectCommand })),
  ]);

  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  return { deleted: true, key };
}

/**
 * Health check: verify credentials by listing a single object.
 */
export async function healthCheck() {
  if (!isConfigured()) {
    return { reachable: false, reason: 'Storage credentials not configured' };
  }
  try {
    const [s3, { ListObjectsV2Command }] = await Promise.all([
      getS3Client(),
      import('@aws-sdk/client-s3').then((m) => ({ ListObjectsV2Command: m.ListObjectsV2Command })),
    ]);
    await s3.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, MaxKeys: 1 }));
    return { reachable: true };
  } catch (err) {
    return { reachable: false, reason: err.message };
  }
}

export const S3StorageProvider = {
  isConfigured,
  validateConfig,
  buildKey,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  deleteObject,
  healthCheck,
};
export default S3StorageProvider;
