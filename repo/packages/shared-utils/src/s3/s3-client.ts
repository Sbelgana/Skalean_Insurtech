/**
 * Skalean InsurTech v2.2 -- S3 client factory + singleton
 *
 * Wraps @aws-sdk/client-s3 with :
 *   - Provider abstraction MinIO dev / Atlas Cloud Services Benguerir prod
 *   - Region default ma-bgr-1 (Morocco-Benguerir-1)
 *   - Lazy init via getS3Client()
 *   - Singleton (one client per session)
 *
 * Reference :
 *   - 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.7)
 *   - decision-008 (data residency Maroc)
 *   - storage-provider.md
 */

import {
  S3Client,
  type S3ClientConfig,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============================================================================
// Configuration types
// ============================================================================

export interface S3Config {
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  kmsKeyBase?: string;
}

// ============================================================================
// Singleton storage
// ============================================================================

let cachedClient: S3Client | null = null;
let cachedConfig: S3Config | null = null;

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new S3 client. NOT cached. Use for tests or one-off.
 * For singleton usage, prefer getS3Client().
 */
export function createS3Client(config: S3Config): S3Client {
  const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle = false } = config;

  if (!region) {
    throw new Error('S3 region is required');
  }
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 access keys required');
  }

  const clientConfig: S3ClientConfig = {
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  };

  if (endpoint) {
    clientConfig.endpoint = endpoint;
  }

  return new S3Client(clientConfig);
}

/**
 * Get singleton S3 client. Initialized lazily.
 * Reads config from env vars on first call.
 */
export function getS3Client(): S3Client {
  if (cachedClient) return cachedClient;

  const endpoint = process.env['S3_ENDPOINT'];
  const region = process.env['S3_REGION'] ?? 'ma-bgr-1';
  const accessKeyId = process.env['S3_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['S3_SECRET_ACCESS_KEY'];
  const forcePathStyle = process.env['S3_FORCE_PATH_STYLE'] === 'true';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY env vars required');
  }

  const config: S3Config = {
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
  };

  cachedClient = createS3Client(config);
  cachedConfig = config;
  return cachedClient;
}

/**
 * Close singleton S3 client.
 */
export function closeS3Client(): void {
  if (cachedClient) {
    cachedClient.destroy();
    cachedClient = null;
    cachedConfig = null;
  }
}

/**
 * Reset for tests.
 */
export function _resetS3ClientForTests(): void {
  closeS3Client();
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate presigned URL for download. Default expiration 1 hour.
 */
export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Generate presigned URL for upload. Default expiration 15 minutes.
 */
export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 900,
): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Check bucket exists.
 */
export async function bucketExists(bucket: string): Promise<boolean> {
  try {
    const client = getS3Client();
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (e) {
    if ((e as { name?: string }).name === 'NotFound') return false;
    throw e;
  }
}

/**
 * Get tenant-scoped bucket name based on environment.
 */
export function getBucketName(
  usage: 'docs' | 'photos' | 'archive',
  env: string = process.env['NODE_ENV'] ?? 'dev',
): string {
  return `skalean-insurtech-${env}-${usage}`;
}

/**
 * Get tenant-scoped object key.
 * Pattern: {tenant_id}/{module}/{entity}/{file}
 */
export function getTenantObjectKey(tenantId: string, ...parts: string[]): string {
  return [tenantId, ...parts].join('/');
}

// Expose cachedConfig for diagnostics (read-only)
export function getS3Config(): S3Config | null {
  return cachedConfig;
}
