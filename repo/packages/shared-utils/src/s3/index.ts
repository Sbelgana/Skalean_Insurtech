export {
  createS3Client,
  getS3Client,
  closeS3Client,
  bucketExists,
  getBucketName,
  getTenantObjectKey,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  getS3Config,
  _resetS3ClientForTests,
  type S3Config,
} from './s3-client.js';

export {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
