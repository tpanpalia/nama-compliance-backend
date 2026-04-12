import { WorkOrderStatus } from '@prisma/client'
import { AppError } from '../../middleware/errorHandler'
import { workOrderRepository } from '../../repositories/workOrder.repository'
import { contractorRepository } from '../../repositories/contractor.repository'
import { evidenceRepository } from '../../repositories/evidence.repository'
import { fileRepository } from '../../repositories/file.repository'
import { auditLogRepository } from '../../repositories/auditLog.repository'
import { notificationRepository } from '../../repositories/notification.repository'
import { userRepository } from '../../repositories/user.repository'

export const contractorWorkOrderService = {
  list: async (userId: string, params: { status?: string; page: number; limit: number }) => {
    const profile = await contractorRepository.findByUserId(userId)
    if (!profile) throw new AppError(404, 'Contractor profile not found')

    const skip  = (params.page - 1) * params.limit
    const where = {
      contractorCr: profile.crNumber,
      status: params.status
        ? (params.status as WorkOrderStatus)
        : { not: 'UNASSIGNED' as WorkOrderStatus },
    }

    const [items, total] = await Promise.all([
      workOrderRepository.findManyForContractor({ where, skip, take: params.limit }),
      workOrderRepository.count(where),
    ])

    return { items, total }
  },

  getById: async (userId: string, workOrderId: string) => {
    const profile = await contractorRepository.findByUserId(userId)
    if (!profile) throw new AppError(404, 'Contractor profile not found')

    const wo = await workOrderRepository.findByIdForContractor(workOrderId)
    if (!wo || wo.contractorCr !== profile.crNumber) throw new AppError(404, 'Work order not found')

    return wo
  },

  start: async (userId: string, workOrderId: string) => {
    const profile = await contractorRepository.findByUserId(userId)
    if (!profile) throw new AppError(404, 'Contractor profile not found')

    const wo = await workOrderRepository.findById(workOrderId)
    if (!wo || wo.contractorCr !== profile.crNumber) throw new AppError(404, 'Work order not found')
    if (wo.status !== 'ASSIGNED') throw new AppError(400, 'Work order must be ASSIGNED to start')

    const updated = await workOrderRepository.updateStatus(workOrderId, 'IN_PROGRESS')

    await auditLogRepository.create({
      performedBy: userId,
      entityType:  'WORK_ORDER',
      entityId:    workOrderId,
      action:      'UPDATED',
      metadata:    { status: 'IN_PROGRESS', action: 'contractor_started' },
    })

    return updated
  },

  submit: async (userId: string, workOrderId: string) => {
    const profile = await contractorRepository.findByUserId(userId)
    if (!profile) throw new AppError(404, 'Contractor profile not found')

    const wo = await workOrderRepository.findById(workOrderId)
    if (!wo || wo.contractorCr !== profile.crNumber) throw new AppError(404, 'Work order not found')
    if (wo.status !== 'IN_PROGRESS') throw new AppError(400, 'Work order must be IN_PROGRESS to submit')

    const evidenceCount = await evidenceRepository.countByWorkOrder(workOrderId, 'CONTRACTOR')
    if (evidenceCount === 0) throw new AppError(400, 'At least one evidence item must be uploaded before submitting')

    const now     = new Date()

    // Calculate inspection deadline based on submission date
    const day = now.getDate()
    let inspectionDeadline: Date
    if (day <= 25) {
      // Rule 1: Days 1-25 → last day of same month
      inspectionDeadline = new Date(now.getFullYear(), now.getMonth() + 1, 0) // day 0 of next month = last day of current month
    } else {
      // Rule 2: Days 26-31 → last day of month + 7 days grace
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      inspectionDeadline = new Date(lastDayOfMonth.getTime() + 7 * 24 * 60 * 60 * 1000)
    }

    const updated = await workOrderRepository.update(workOrderId, { status: 'SUBMITTED', submissionDate: now, inspectionDeadline })

    await auditLogRepository.create({
      performedBy: userId,
      entityType:  'WORK_ORDER',
      entityId:    workOrderId,
      action:      'SUBMITTED',
      metadata:    { submittedAt: now.toISOString() },
    })

    const admins = await userRepository.findActiveAdmins()
    if (admins.length > 0) {
      await notificationRepository.createMany({
        data: admins.map((admin) => ({
          userId:      admin.id,
          type:        'WORK_ORDER_SUBMITTED' as const,
          title:       'Work Order Submitted',
          message:     `Contractor work submitted for ${workOrderId}. Ready for inspection.`,
          workOrderId,
        })),
      })
    }

    return updated
  },

  addEvidence: async (userId: string, workOrderId: string, data: {
    checklistItemId: string
    fileId:          string
    comment?:        string
    gpsLat?:         number
    gpsLng?:         number
    gpsAccuracy?:    number
    gpsAddress?:     string
    capturedAt?:     string
  }) => {
    const profile = await contractorRepository.findByUserId(userId)
    if (!profile) throw new AppError(404, 'Contractor profile not found')

    const wo = await workOrderRepository.findById(workOrderId)
    if (!wo || wo.contractorCr !== profile.crNumber) throw new AppError(404, 'Work order not found')

    const allowedStatuses: WorkOrderStatus[] = ['ASSIGNED', 'IN_PROGRESS']
    if (!allowedStatuses.includes(wo.status)) {
      throw new AppError(400, `Cannot upload evidence when work order is ${wo.status}`)
    }

    const file = await fileRepository.findById(data.fileId)
    if (!file || file.uploadedBy !== userId || file.uploadStatus !== 'UPLOADED') {
      throw new AppError(400, 'Invalid or unconfirmed file')
    }

    return evidenceRepository.create({
      workOrderId,
      checklistItemId: data.checklistItemId,
      uploadedBy:      userId,
      uploadedByRole:  'CONTRACTOR',
      fileId:          data.fileId,
      comment:         data.comment,
      gpsLat:          data.gpsLat,
      gpsLng:          data.gpsLng,
      gpsAccuracy:     data.gpsAccuracy,
      gpsAddress:      data.gpsAddress,
      capturedAt:      data.capturedAt ? new Date(data.capturedAt) : undefined,
    })
  },
}
