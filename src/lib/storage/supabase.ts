import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from '../../config'
import type { StorageService, PresignedUpload } from './index'

export class SupabaseAdapter implements StorageService {
  private client: SupabaseClient
  private bucket: string

  constructor() {
    this.bucket = config.storage.supabase.bucket
    this.client = createClient(
      config.storage.supabase.url,
      config.storage.supabase.serviceKey,
    )
  }

  async presignUpload(params: {
    fileId: string
    s3Key: string
    mimeType: string
    expiresInSeconds?: number
  }): Promise<PresignedUpload> {
    const expiresIn = params.expiresInSeconds ?? 900
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(params.s3Key)

    if (error || !data) {
      throw new Error(`Supabase presign failed: ${error?.message}`)
    }

    const publicUrl = this.client.storage
      .from(this.bucket)
      .getPublicUrl(params.s3Key).data.publicUrl

    return {
      fileId: params.fileId,
      uploadUrl: data.signedUrl,
      publicUrl,
      expiresInSeconds: expiresIn,
    }
  }

  async presignRead(s3Key: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(s3Key, expiresInSeconds)

    if (error || !data) {
      throw new Error(`Supabase signed URL failed: ${error?.message}`)
    }
    return data.signedUrl
  }

  async presignReadThumb(s3Key: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(s3Key, expiresInSeconds, {
        transform: { width: 200, height: 200, resize: 'cover' },
      })

    if (error || !data) {
      throw new Error(`Supabase signed URL failed: ${error?.message}`)
    }
    return data.signedUrl
  }

  async upload(s3Key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(s3Key, buffer, { contentType: mimeType, upsert: true })
    if (error) throw new Error(`Supabase upload failed: ${error.message}`)
  }

  async delete(s3Key: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([s3Key])
    if (error) throw new Error(`Supabase delete failed: ${error.message}`)
  }

  buildKey(category: string, fileId: string, filename: string): string {
    const ext = filename.includes('.') ? filename.split('.').pop() : ''
    return `${category}/${fileId}${ext ? '.' + ext : ''}`
  }
}
