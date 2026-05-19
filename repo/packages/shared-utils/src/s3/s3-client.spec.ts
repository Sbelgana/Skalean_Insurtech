import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createS3Client,
  getS3Client,
  closeS3Client,
  _resetS3ClientForTests,
  getBucketName,
  getTenantObjectKey,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  bucketExists,
} from './s3-client.js';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const MINIO_ENDPOINT = process.env['S3_ENDPOINT'] ?? 'http://localhost:9000';
const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe('S3 client factory -- Tache 1.1.7', () => {
  beforeEach(() => {
    _resetS3ClientForTests();
    process.env['S3_ENDPOINT'] = MINIO_ENDPOINT;
    process.env['S3_REGION'] = 'ma-bgr-1';
    process.env['S3_ACCESS_KEY_ID'] = 'skalean';
    process.env['S3_SECRET_ACCESS_KEY'] = 'skalean_minio_dev_only';
    process.env['S3_FORCE_PATH_STYLE'] = 'true';
  });

  afterEach(() => {
    closeS3Client();
  });

  describe('Validation', () => {
    it('should throw if region missing', () => {
      expect(() =>
        createS3Client({
          region: '',
          accessKeyId: 'a',
          secretAccessKey: 'b',
        }),
      ).toThrow(/region is required/);
    });

    it('should throw if access key missing', () => {
      expect(() =>
        createS3Client({
          region: 'ma-bgr-1',
          accessKeyId: '',
          secretAccessKey: 'b',
        }),
      ).toThrow(/access keys required/);
    });
  });

  describe('Singleton', () => {
    it('getS3Client returns same instance on multiple calls', () => {
      const c1 = getS3Client();
      const c2 = getS3Client();
      expect(c1).toBe(c2);
    });

    it('closeS3Client resets singleton', () => {
      const c1 = getS3Client();
      closeS3Client();
      const c2 = getS3Client();
      expect(c1).not.toBe(c2);
    });

    it('should throw if S3_ACCESS_KEY_ID not set', () => {
      delete process.env['S3_ACCESS_KEY_ID'];
      expect(() => getS3Client()).toThrow(/S3_ACCESS_KEY_ID/);
    });
  });

  describe('getBucketName', () => {
    it('returns formatted bucket name for docs', () => {
      expect(getBucketName('docs', 'dev')).toBe('skalean-insurtech-dev-docs');
    });

    it('returns formatted bucket name for photos', () => {
      expect(getBucketName('photos', 'dev')).toBe('skalean-insurtech-dev-photos');
    });

    it('returns formatted bucket name for archive', () => {
      expect(getBucketName('archive', 'dev')).toBe('skalean-insurtech-dev-archive');
    });

    it('uses prod env', () => {
      expect(getBucketName('docs', 'production')).toBe('skalean-insurtech-production-docs');
    });
  });

  describe('getTenantObjectKey', () => {
    it('builds tenant-scoped key', () => {
      expect(getTenantObjectKey('tenant-uuid', 'polices', 'police-uuid.pdf')).toBe(
        'tenant-uuid/polices/police-uuid.pdf',
      );
    });

    it('handles multiple parts', () => {
      expect(getTenantObjectKey('tenant-abc', 'sinistres', 'sin-001', 'photo-01.jpg')).toBe(
        'tenant-abc/sinistres/sin-001/photo-01.jpg',
      );
    });
  });
});

describe.skipIf(SKIP)('S3 integration -- MinIO local', () => {
  beforeEach(() => {
    _resetS3ClientForTests();
    process.env['S3_ENDPOINT'] = MINIO_ENDPOINT;
    process.env['S3_REGION'] = 'ma-bgr-1';
    process.env['S3_ACCESS_KEY_ID'] = 'skalean';
    process.env['S3_SECRET_ACCESS_KEY'] = 'skalean_minio_dev_only';
    process.env['S3_FORCE_PATH_STYLE'] = 'true';
  });

  afterEach(() => closeS3Client());

  it('should connect to MinIO', async () => {
    expect(await bucketExists('skalean-insurtech-dev-docs')).toBe(true);
  });

  it('should upload + download text file', async () => {
    const client = getS3Client();
    const bucket = 'skalean-insurtech-dev-docs';
    const key = `test/integration-${Date.now()}.txt`;
    const body = 'Hello Skalean InsurTech';

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'text/plain',
      }),
    );

    const getCmd = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const downloaded = await getCmd.Body!.transformToString();
    expect(downloaded).toBe(body);

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  });

  it('should generate presigned download URL', async () => {
    const url = await getPresignedDownloadUrl('skalean-insurtech-dev-docs', 'test-key', 3600);
    expect(url).toContain('skalean-insurtech-dev-docs');
    expect(url).toContain('X-Amz-Signature');
  });

  it('should generate presigned upload URL', async () => {
    const url = await getPresignedUploadUrl('skalean-insurtech-dev-docs', 'test-key', 900);
    expect(url).toContain('X-Amz-Signature');
  });
});
