import { AppError } from '../../middleware/errorHandler'
import { evidenceRepository } from '../../repositories/evidence.repository'
import { inspectionRepository } from '../../repositories/inspection.repository'
import { fileRepository } from '../../repositories/file.repository'

export const inspectorEvidenceService = {
  create: async (userId: string, data: {
    inspectionId:    string
    workOrderId:     string
    checklistItemId: string
    fileId:          string
    comment?:        string
    gpsLat?:         number
    gpsLng?:         number
    gpsAccuracy?:    number
    gpsAddress?:     string
    capturedAt?:     string
  }) => {
    const inspection = await inspectionRepository.findByIdForEvidence(data.inspectionId)
    if (!inspection || inspection.workOrder.assignedInspectorId !== userId) {
      throw new AppError(403, 'Not your inspection')
    }
    if (inspection.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'Inspection must be IN_PROGRESS to add evidence')
    }

    const file = await fileRepository.findById(data.fileId)
    if (!file || file.uploadedBy !== userId || file.uploadStatus !== 'UPLOADED') {
      throw new AppError(400, 'Invalid or unconfirmed file')
    }

    return evidenceRepository.create({
      workOrderId:     data.workOrderId,
      inspectionId:    data.inspectionId,
      checklistItemId: data.checklistItemId,
      uploadedBy:      userId,
      uploadedByRole:  'INSPECTOR',
      fileId:          data.fileId,
      comment:         data.comment,
      gpsLat:          data.gpsLat,
      gpsLng:          data.gpsLng,
      gpsAccuracy:     data.gpsAccuracy,
      gpsAddress:      data.gpsAddress,
      capturedAt:      data.capturedAt ? new Date(data.capturedAt) : undefined,
    })
  },

  delete: async (userId: string, evidenceId: string) => {
    const evidence = await evidenceRepository.findById(evidenceId)
    if (!evidence || evidence.uploadedBy !== userId) {
      throw new AppError(404, 'Evidence not found')
    }
    if (evidence.inspection?.status === 'SUBMITTED') {
      throw new AppError(400, 'Cannot delete evidence from a submitted inspection')
    }

    await evidenceRepository.delete(evidenceId)
    return { ok: true }
  },
}
