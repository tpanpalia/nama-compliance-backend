import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { config } from '../../config'
import type { StorageService, PresignedUpload } from './index'

export class S3Adapter implements StorageService {
  private client: S3Client
  private bucket: string

  constructor() {
    this.bucket = config.storage.s3.bucket
    this.client = new S3Client({
      region: config.storage.s3.region,
      credentials: {
        accessKeyId: config.storage.s3.accessKeyId,
        secretAccessKey: config.storage.s3.secretAccessKey,
      },
    })
  }

  async presignUpload(params: {
    fileId: string
    s3Key: string
    mimeType: string
    expiresInSeconds?: number
  }): Promise<PresignedUpload> {
    const expiresIn = params.expiresInSeconds ?? 900 // 15 min default
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.s3Key,
      ContentType: params.mimeType,
    })
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn })
    const publicUrl = `https://${this.bucket}.s3.${config.storage.s3.region}.amazonaws.com/${params.s3Key}`
    return { fileId: params.fileId, uploadUrl, publicUrl, expiresInSeconds: expiresIn }
  }

  async presignRead(s3Key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: s3Key })
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
  }

  async delete(s3Key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: s3Key })
    await this.client.send(command)
  }

  buildKey(category: string, fileId: string, filename: string): string {
    const ext = filename.includes('.') ? filename.split('.').pop() : ''
    return `${category}/${fileId}${ext ? '.' + ext : ''}`
  }
}
