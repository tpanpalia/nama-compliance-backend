import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { PRESIGNED_URL_EXPIRES, s3Client, S3_BUCKET } from '../config/aws';

const extFromContentType = (contentType: string): string => {
  const [, ext] = contentType.split('/');
  return ext || 'bin';
};

export const buildEvidenceKey = (workOrderId: string, contentType: string): string => {
  const ext = extFromContentType(contentType);
  return `evidence/${workOrderId}/${uuidv4()}.${ext}`;
};

export const buildChecklistEvidenceKey = (
  workOrderId: string,
  checklistItemId: string,
  contentType: string
): string => {
  const ext = extFromContentType(contentType);
  return `evidence/${workOrderId}/${checklistItemId}/${uuidv4()}.${ext}`;
};

export const generateUploadPresignedUrl = async (
  key: string,
  contentType: string,
  expiresIn = PRESIGNED_URL_EXPIRES
): Promise<{ uploadUrl: string; key: string; expiresAt: string }> => {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return {
    uploadUrl,
    key,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
};

export const generateDownloadPresignedUrl = async (
  key: string,
  expiresIn = PRESIGNED_URL_EXPIRES
): Promise<{ downloadUrl: string; expiresAt: string }> => {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return {
    downloadUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
};

export const deleteObject = async (key: string): Promise<void> => {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
};

export const getObjectMetadata = async (key: string): Promise<{
  fileSize: number;
  contentType: string;
  lastModified: string | null;
}> => {
  const output = await s3Client.send(
    new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );

  return {
    fileSize: output.ContentLength || 0,
    contentType: output.ContentType || 'application/octet-stream',
    lastModified: output.LastModified ? output.LastModified.toISOString() : null,
  };
};

export const generateObjectUrl = (key: string): string => {
  const endpoint = process.env.S3_PUBLIC_BASE_URL || process.env.S3_ENDPOINT;

  if (endpoint) {
    const normalized = endpoint.replace(/\/$/, '');
    const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || 'false').toLowerCase() === 'true';

    if (forcePathStyle) {
      return `${normalized}/${S3_BUCKET}/${key}`;
    }

    try {
      const url = new URL(normalized);
      return `${url.protocol}//${S3_BUCKET}.${url.host}/${key}`;
    } catch {
      return `${normalized}/${key}`;
    }
  }

  const region = process.env.AWS_REGION || 'me-south-1';
  return `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
};
