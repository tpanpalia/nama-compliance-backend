import { S3Client } from '@aws-sdk/client-s3';

const s3Endpoint = process.env.S3_ENDPOINT;
const s3ForcePathStyle = (process.env.S3_FORCE_PATH_STYLE || 'false').toLowerCase() === 'true';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'me-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  ...(s3Endpoint ? { endpoint: s3Endpoint, forcePathStyle: s3ForcePathStyle } : {}),
});

export const S3_BUCKET = process.env.S3_BUCKET_NAME || '';
export const PRESIGNED_URL_EXPIRES = parseInt(process.env.S3_PRESIGNED_URL_EXPIRES || '3600', 10);
