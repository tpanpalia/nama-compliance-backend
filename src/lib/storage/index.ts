import { config } from '../../config'

export interface PresignedUpload {
  fileId: string
  uploadUrl: string
  publicUrl: string  // URL to access the file after upload
  expiresInSeconds: number
}

export interface StorageService {
  /** Generate a presigned URL for the client to upload a file directly */
  presignUpload(params: {
    fileId: string
    s3Key: string
    mimeType: string
    expiresInSeconds?: number
  }): Promise<PresignedUpload>

  /** Generate a short-lived signed URL to read a private file */
  presignRead(s3Key: string, expiresInSeconds?: number): Promise<string>

  /** Delete a file from storage */
  delete(s3Key: string): Promise<void>

  /** Build the permanent storage key for a file */
  buildKey(category: string, fileId: string, filename: string): string
}

let _instance: StorageService | undefined

export function getStorageService(): StorageService {
  if (_instance) return _instance

  if (config.storage.provider === 's3') {
    const { S3Adapter } = require('./s3')
    _instance = new S3Adapter()
  } else {
    const { SupabaseAdapter } = require('./supabase')
    _instance = new SupabaseAdapter()
  }

  return _instance!
}
