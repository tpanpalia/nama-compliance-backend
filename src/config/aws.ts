import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'me-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export const S3_BUCKET = process.env.S3_BUCKET_NAME || '';
export const PRESIGNED_URL_EXPIRES = parseInt(process.env.S3_PRESIGNED_URL_EXPIRES || '3600', 10);
