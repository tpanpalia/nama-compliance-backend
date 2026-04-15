import { FileCategory } from '@prisma/client'
import { AppError } from '../middleware/errorHandler'
import { fileRepository } from '../repositories/file.repository'
import { getStorageService } from '../lib/storage'
import { prisma } from '../lib/prisma'

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

  getUrl: async (fileId: string, userId: string, userRole: string) => {
    const file = await fileRepository.findById(fileId)
    if (!file || file.isDeleted) throw new AppError(404, 'File not found')

    // ADMIN and REGULATOR can access all files
    if (userRole !== 'ADMIN' && userRole !== 'REGULATOR') {
      // Check if user is the uploader
      const isUploader = file.uploadedBy === userId

      if (!isUploader) {
        let hasAccess = false

        // For INSPECTOR: allow if the file is evidence on a WO assigned to them
        if (userRole === 'INSPECTOR') {
          const evidenceLink = await prisma.evidence.findFirst({
            where: { fileId: file.id },
            include: { workOrder: { select: { assignedInspectorId: true } } },
          })
          if (evidenceLink?.workOrder.assignedInspectorId === userId) {
            hasAccess = true
          }
        }

        // For CONTRACTOR: allow if the file is evidence on a WO belonging to them
        if (userRole === 'CONTRACTOR') {
          const evidenceLink = await prisma.evidence.findFirst({
            where: { fileId: file.id },
            include: { workOrder: { select: { contractorCr: true } } },
          })
          if (evidenceLink) {
            const contractorProfile = await prisma.contractorProfile.findFirst({
              where: { userId },
              select: { crNumber: true },
            })
            if (contractorProfile && evidenceLink.workOrder.contractorCr === contractorProfile.crNumber) {
              hasAccess = true
            }
          }
        }

        if (!hasAccess) {
          throw new AppError(403, 'You do not have access to this file')
        }
      }
    }

    try {
      const storage = getStorageService()
      const isImage = file.mimeType?.startsWith('image/')
      const [url, thumbnailUrl] = await Promise.all([
        storage.presignRead(file.s3Key, 3600),
        isImage ? storage.presignReadThumb(file.s3Key, 3600).catch(() => null) : Promise.resolve(null),
      ])
      return { url, thumbnailUrl, expiresInSeconds: 3600 }
    } catch {
      return { url: '', thumbnailUrl: null, expiresInSeconds: 0 }
    }
  },
}
