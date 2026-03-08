import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../utils/AppError';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || '';
const SUPABASE_STORAGE_SIGNED_URL_EXPIRES = parseInt(
  process.env.SUPABASE_STORAGE_SIGNED_URL_EXPIRES || '3600',
  10
);

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const ensureStorageConfig = (): void => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_STORAGE_BUCKET) {
    throw new AppError(
      'Supabase Storage is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.',
      500,
      'STORAGE_NOT_CONFIGURED'
    );
  }
};

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
  _contentType: string
): Promise<{ uploadUrl: string; key: string; expiresAt: string }> => {
  ensureStorageConfig();

  const { data, error } = await supabaseAdmin.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUploadUrl(key);

  if (error || !data) {
    throw new AppError(error?.message || 'Failed to create upload URL', 500, 'STORAGE_ERROR');
  }

  const uploadUrl =
    data.signedUrl ||
    `${SUPABASE_URL}/storage/v1/object/upload/sign/${SUPABASE_STORAGE_BUCKET}/${key}?token=${data.token}`;

  return {
    uploadUrl,
    key,
    expiresAt: new Date(Date.now() + SUPABASE_STORAGE_SIGNED_URL_EXPIRES * 1000).toISOString(),
  };
};

export const generateDownloadPresignedUrl = async (
  key: string,
  expiresIn = SUPABASE_STORAGE_SIGNED_URL_EXPIRES
): Promise<{ downloadUrl: string; expiresAt: string }> => {
  ensureStorageConfig();

  const { data, error } = await supabaseAdmin.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(key, expiresIn);

  if (error || !data) {
    throw new AppError(error?.message || 'Failed to create download URL', 500, 'STORAGE_ERROR');
  }

  return {
    downloadUrl: data.signedUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
};

export const deleteObject = async (key: string): Promise<void> => {
  ensureStorageConfig();

  const { error } = await supabaseAdmin.storage.from(SUPABASE_STORAGE_BUCKET).remove([key]);
  if (error) {
    throw new AppError(error.message, 500, 'STORAGE_ERROR');
  }
};

export const getObjectMetadata = async (key: string): Promise<{
  fileSize: number;
  contentType: string;
  lastModified: string | null;
}> => {
  ensureStorageConfig();

  const { data, error } = await supabaseAdmin.storage.from(SUPABASE_STORAGE_BUCKET).info(key);

  if (error || !data) {
    throw new AppError(error?.message || 'Uploaded file not found', 400, 'STORAGE_OBJECT_NOT_FOUND');
  }

  return {
    fileSize: data.metadata?.size || 0,
    contentType: data.metadata?.mimetype || 'application/octet-stream',
    lastModified: data.updatedAt || null,
  };
};

export const generateObjectUrl = (key: string): string => {
  ensureStorageConfig();

  const explicitBase = process.env.SUPABASE_STORAGE_PUBLIC_URL;
  if (explicitBase) {
    return `${explicitBase.replace(/\/$/, '')}/${key}`;
  }

  const { data } = supabaseAdmin.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(key);
  return data.publicUrl;
};

export const uploadReportPDF = async (
  buffer: Buffer,
  reportType: string,
  filename: string
): Promise<{ key: string; url: string; size: number }> => {
  ensureStorageConfig();

  const key = `reports/${reportType}/${Date.now()}_${filename}`;
  const { data, error } = await supabaseAdmin.storage.from(SUPABASE_STORAGE_BUCKET).upload(key, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });

  if (error || !data) {
    throw new AppError(error?.message || 'Failed to upload report PDF', 500, 'STORAGE_ERROR');
  }

  const { data: urlData } = supabaseAdmin.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(data.path);

  return {
    key,
    url: urlData.publicUrl,
    size: buffer.length,
  };
};
