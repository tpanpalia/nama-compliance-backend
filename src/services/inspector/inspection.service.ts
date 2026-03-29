import { RatingValue } from '@prisma/client'
import { AppError } from '../../middleware/errorHandler'
import { inspectionRepository } from '../../repositories/inspection.repository'
import { notificationRepository } from '../../repositories/notification.repository'
import { userRepository } from '../../repositories/user.repository'
import { calculateScores } from '../../utils/scoring'
import { prisma } from '../../lib/prisma'

export const inspectorInspectionService = {
  list: async (userId: string, params: { status?: string; page: number; limit: number }) => {
    const skip  = (params.page - 1) * params.limit
    const where = {
      workOrder: { assignedInspectorId: userId },
      ...(params.status ? { status: params.status as 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' } : {}),
    }

    const [items, total] = await Promise.all([
      inspectionRepository.findMany({ where, skip, take: params.limit }),
      inspectionRepository.count(where),
    ])

    return { items, total }
  },

  getById: async (userId: string, inspectionId: string) => {
    const inspection = await inspectionRepository.findByIdFull(inspectionId)
    if (!inspection) throw new AppError(404, 'Inspection not found')
    if (inspection.workOrder.assignedInspectorId !== userId) {
      throw new AppError(403, 'Not your inspection')
    }
    return inspection
  },

  start: async (userId: string, inspectionId: string) => {
    const inspection = await inspectionRepository.findByIdWithWorkOrder(inspectionId)
    if (!inspection) throw new AppError(404, 'Inspection not found')
    if (inspection.workOrder.assignedInspectorId !== userId) {
      throw new AppError(403, 'Not your inspection')
    }
    if (inspection.status !== 'PENDING') {
      throw new AppError(400, `Inspection is already ${inspection.status}`)
    }

    await prisma.$transaction([
      prisma.inspection.update({ where: { id: inspectionId }, data: { status: 'IN_PROGRESS' } }),
      prisma.workOrder.update({ where: { id: inspection.workOrder.id }, data: { status: 'INSPECTION_IN_PROGRESS' } }),
      prisma.auditLog.create({
        data: {
          performedBy: userId,
          entityType:  'INSPECTION',
          entityId:    inspectionId,
          action:      'INSPECTION_STARTED',
          metadata:    { workOrderId: inspection.workOrderId },
        },
      }),
    ])

    return { ok: true }
  },

  saveResponses: async (userId: string, inspectionId: string, responses: {
    checklistItemId: string
    rating?: RatingValue | null
    inspectorComments?: string | null
  }[]) => {
    const inspection = await inspectionRepository.findByIdForEvidence(inspectionId)
    if (!inspection) throw new AppError(404, 'Inspection not found')
    if (inspection.workOrder.assignedInspectorId !== userId) {
      throw new AppError(403, 'Not your inspection')
    }
    if (inspection.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'Inspection must be IN_PROGRESS to save responses')
    }

    await inspectionRepository.updateResponses(
      inspectionId,
      responses.map((r) => ({
        checklistItemId:   r.checklistItemId,
        rating:            r.rating ?? null,
        inspectorComments: r.inspectorComments ?? null,
      })),
    )

    return { ok: true, saved: responses.length }
  },

  submit: async (userId: string, inspectionId: string) => {
    const inspection = await inspectionRepository.findByIdWithScores(inspectionId)
    if (!inspection) throw new AppError(404, 'Inspection not found')
    if (inspection.workOrder.assignedInspectorId !== userId) {
      throw new AppError(403, 'Not your inspection')
    }
    if (inspection.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'Inspection must be IN_PROGRESS to submit')
    }

    const unrated = inspection.responses.filter((r) => !r.rating)
    if (unrated.length > 0) {
      throw new AppError(400, `${unrated.length} checklist item(s) have no rating. Complete all items before submitting.`)
    }

    const scoreInputs = inspection.responses.map((r) => ({
      checklistItemId: r.checklistItemId,
      category:        r.checklistItem.category,
      itemWeight:      r.checklistItem.weight,
      rating:          r.rating!,
    }))

    const sw = inspection.workOrder.scoringWeights
    const { categoryScores, finalScore, complianceRating } = calculateScores(scoreInputs, {
      hsePercent:       sw.hsePercent,
      technicalPercent: sw.technicalPercent,
      processPercent:   sw.processPercent,
      closurePercent:   sw.closurePercent,
    })

    const now = new Date()

    await prisma.$transaction([
      prisma.inspection.update({
        where: { id: inspectionId },
        data: {
          hseScore:        categoryScores.hse,
          technicalScore:  categoryScores.technical,
          processScore:    categoryScores.process,
          closureScore:    categoryScores.closure,
          finalScore,
          complianceRating,
          status:          'SUBMITTED',
          submittedAt:     now,
        },
      }),
      prisma.workOrder.update({
        where: { id: inspection.workOrderId },
        data:  { status: 'INSPECTION_COMPLETED' },
      }),
      prisma.auditLog.create({
        data: {
          performedBy: userId,
          entityType:  'INSPECTION',
          entityId:    inspectionId,
          action:      'INSPECTION_COMPLETED',
          metadata:    { finalScore, complianceRating, workOrderId: inspection.workOrderId },
        },
      }),
    ])

    const admins = await userRepository.findActiveAdmins()
    if (admins.length > 0) {
      await notificationRepository.createMany({
        data: admins.map((admin) => ({
          userId:      admin.id,
          type:        'INSPECTION_COMPLETED' as const,
          title:       'Inspection Completed',
          message:     `Inspection for work order ${inspection.workOrderId} completed. Score: ${finalScore}% (${complianceRating})`,
          workOrderId: inspection.workOrderId,
        })),
      })
    }

    return { finalScore, complianceRating, categoryScores }
  },
}
