import { FileCategory } from '@prisma/client'
import { AppError } from '../middleware/errorHandler'
import { fileRepository } from '../repositories/file.repository'
import { getStorageService } from '../lib/storage'

export const fileService = {
  presign: async (userId: string, data: {
    filename: string
    mimeType: string
    category: FileCategory
    fileSize?: number
  }) => {
    const file = await fileRepository.create({
      bucket:       data.category.toLowerCase().replace(/_/g, '-'),
      s3Key:        'pending',
      mimeType:     data.mimeType,
      category:     data.category,
      uploadStatus: 'PENDING',
      fileSize:     data.fileSize != null ? BigInt(data.fileSize) : undefined,
      uploadedBy:   userId,
    })

    const storage = getStorageService()
    const s3Key   = storage.buildKey(data.category.toLowerCase(), file.id, data.filename)
    await fileRepository.updateKey(file.id, s3Key)

    return storage.presignUpload({ fileId: file.id, s3Key, mimeType: data.mimeType, expiresInSeconds: 900 })
  },

  confirm: async (userId: string, fileId: string) => {
    const file = await fileRepository.findById(fileId)
    if (!file || file.uploadedBy !== userId) throw new AppError(404, 'File not found')
    if (file.uploadStatus === 'UPLOADED') return { ok: true, fileId: file.id }

    await fileRepository.confirm(file.id)
    return { ok: true, fileId: file.id }
  },

  getUrl: async (fileId: string) => {
    const file = await fileRepository.findById(fileId)
    if (!file || file.isDeleted) throw new AppError(404, 'File not found')

    const url = await getStorageService().presignRead(file.s3Key, 3600)
    return { url, expiresInSeconds: 3600 }
  },
}
