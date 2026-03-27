import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../utils/AppError';

const AWS_REGION = process.env.AWS_REGION || '';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || '';
const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === 'true';
const S3_PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL || '';
const S3_PRESIGNED_URL_EXPIRES = parseInt(process.env.S3_PRESIGNED_URL_EXPIRES || '3600', 10);

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials:
    AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  endpoint: S3_ENDPOINT || undefined,
  forcePathStyle: S3_FORCE_PATH_STYLE,
});

const ensureStorageConfig = (): void => {
  if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !S3_BUCKET_NAME) {
    throw new AppError(
      'AWS S3 is not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME.',
      500,
      'STORAGE_NOT_CONFIGURED'
    );
  }
};

const extFromContentType = (contentType: string): string => {
  const [, ext] = contentType.split('/');
  return ext || 'bin';
};

const buildObjectUrl = (key: string): string => {
  if (S3_PUBLIC_BASE_URL) {
    return `${S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  }

  if (S3_ENDPOINT) {
    const normalizedEndpoint = S3_ENDPOINT.replace(/\/$/, '');
    if (S3_FORCE_PATH_STYLE) {
      return `${normalizedEndpoint}/${S3_BUCKET_NAME}/${key}`;
    }
    return `${normalizedEndpoint}/${key}`;
  }

  return `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
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
  contentType: string
): Promise<{ uploadUrl: string; key: string; expiresAt: string }> => {
  ensureStorageConfig();

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: S3_PRESIGNED_URL_EXPIRES,
  });

  return {
    uploadUrl,
    key,
    expiresAt: new Date(Date.now() + S3_PRESIGNED_URL_EXPIRES * 1000).toISOString(),
  };
};

export const generateDownloadPresignedUrl = async (
  key: string,
  expiresIn = S3_PRESIGNED_URL_EXPIRES
): Promise<{ downloadUrl: string; expiresAt: string }> => {
  ensureStorageConfig();

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
  });

  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return {
    downloadUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
};

export const deleteObject = async (key: string): Promise<void> => {
  ensureStorageConfig();

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
      })
    );
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Failed to delete object',
      500,
      'STORAGE_ERROR'
    );
  }
};

export const getObjectMetadata = async (key: string): Promise<{
  fileSize: number;
  contentType: string;
  lastModified: string | null;
}> => {
  ensureStorageConfig();

  try {
    const data = await s3Client.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
      })
    );

    return {
      fileSize: data.ContentLength || 0,
      contentType: data.ContentType || 'application/octet-stream',
      lastModified: data.LastModified?.toISOString() || null,
    };
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Uploaded file not found',
      400,
      'STORAGE_OBJECT_NOT_FOUND'
    );
  }
};

export const generateObjectUrl = (key: string): string => {
  ensureStorageConfig();
  return buildObjectUrl(key);
};

export const extractObjectKeyFromUrl = (url: string): string | null => {
  ensureStorageConfig();

  try {
    const parsed = new URL(url);
    const normalizedPath = parsed.pathname.replace(/^\/+/, '');

    if (S3_PUBLIC_BASE_URL) {
      const publicBase = S3_PUBLIC_BASE_URL.replace(/\/$/, '');
      if (url.startsWith(`${publicBase}/`)) {
        return decodeURIComponent(url.slice(publicBase.length + 1));
      }
    }

    if (S3_ENDPOINT) {
      const endpoint = new URL(S3_ENDPOINT);
      if (parsed.origin === endpoint.origin) {
        if (S3_FORCE_PATH_STYLE) {
          if (normalizedPath.startsWith(`${S3_BUCKET_NAME}/`)) {
            return decodeURIComponent(normalizedPath.slice(S3_BUCKET_NAME.length + 1));
          }
        } else {
          return decodeURIComponent(normalizedPath);
        }
      }
    }

    const virtualHostedBucket = `${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`;
    if (parsed.hostname === virtualHostedBucket) {
      return decodeURIComponent(normalizedPath);
    }

    if (normalizedPath.startsWith(`${S3_BUCKET_NAME}/`)) {
      return decodeURIComponent(normalizedPath.slice(S3_BUCKET_NAME.length + 1));
    }

    return null;
  } catch {
    return null;
  }
};

export const generateAccessibleObjectUrl = async (
  key?: string | null,
  fallbackUrl?: string | null
): Promise<string | null> => {
  ensureStorageConfig();

  const resolvedKey = key || (fallbackUrl ? extractObjectKeyFromUrl(fallbackUrl) : null);
  if (!resolvedKey) {
    return fallbackUrl || null;
  }

  const { downloadUrl } = await generateDownloadPresignedUrl(resolvedKey);
  return downloadUrl;
};

export const uploadReportPDF = async (
  buffer: Buffer,
  reportType: string,
  filename: string
): Promise<{ key: string; url: string; size: number }> => {
  ensureStorageConfig();

  const key = `reports/${reportType}/${Date.now()}_${filename}`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      })
    );
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Failed to upload report PDF',
      500,
      'STORAGE_ERROR'
    );
  }

  return {
    key,
    url: buildObjectUrl(key),
    size: buffer.length,
  };
};
