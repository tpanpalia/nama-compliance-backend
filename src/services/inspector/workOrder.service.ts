import { WorkOrderStatus } from '@prisma/client'
import { AppError } from '../../middleware/errorHandler'
import { workOrderRepository } from '../../repositories/workOrder.repository'
import { checklistRepository } from '../../repositories/checklist.repository'
import { auditLogRepository } from '../../repositories/auditLog.repository'
import { inspectionRepository } from '../../repositories/inspection.repository'
import { prisma } from '../../lib/prisma'

export const inspectorWorkOrderService = {
  list: async (userId: string, params: { view: string; page: number; limit: number }) => {
    const skip = (params.page - 1) * params.limit

    let where: object = {}
    if (params.view === 'pool') {
      where = { status: 'SUBMITTED' as WorkOrderStatus, assignedInspectorId: null }
    } else if (params.view === 'mine') {
      where = {
        assignedInspectorId: userId,
        status: { in: ['ASSIGNED', 'PENDING_INSPECTION', 'INSPECTION_IN_PROGRESS', 'OVERDUE'] as WorkOrderStatus[] },
      }
    } else if (params.view === 'completed') {
      where = { assignedInspectorId: userId, status: 'INSPECTION_COMPLETED' as WorkOrderStatus }
    } else if (params.view === 'all') {
      where = { assignedInspectorId: userId }
    }

    const [items, total] = await Promise.all([
      workOrderRepository.findManyForInspector({ where, skip, take: params.limit }),
      workOrderRepository.count(where),
    ])

    return { items, total }
  },

  getById: async (id: string) => {
    const wo = await workOrderRepository.findByIdForInspector(id)
    if (!wo) throw new AppError(404, 'Work order not found')
    return wo
  },

  claim: async (userId: string, workOrderId: string) => {
    const wo = await workOrderRepository.findById(workOrderId)
    if (!wo) throw new AppError(404, 'Work order not found')

    if (wo.status !== 'SUBMITTED') {
      throw new AppError(400, 'Only SUBMITTED work orders can be claimed from the work pool')
    }
    if (wo.assignedInspectorId) {
      throw new AppError(409, 'Work order has already been claimed by another inspector')
    }

    const existingInspection = await inspectionRepository.findByWorkOrderId(workOrderId)
    if (existingInspection) throw new AppError(409, 'An inspection already exists for this work order')

    const checklistVersion = await checklistRepository.findActiveVersion()
    if (!checklistVersion) throw new AppError(500, 'No active checklist version found')

    const checklistItems = await checklistRepository.findAllActive()

    await prisma.$transaction([
      prisma.workOrder.update({
        where: { id: workOrderId },
        data:  { assignedInspectorId: userId, status: 'PENDING_INSPECTION' },
      }),
      prisma.inspection.create({
        data: {
          workOrderId,
          checklistVersionId: checklistVersion.versionNumber,
          status:             'PENDING',
          responses: {
            createMany: {
              data: checklistItems.map((item) => ({
                checklistItemId:  item.id,
                questionSnapshot: item.question,
              })),
            },
          },
        },
      }),
      prisma.auditLog.create({
        data: {
          performedBy: userId,
          entityType:  'WORK_ORDER',
          entityId:    workOrderId,
          action:      'ASSIGNED',
          metadata:    { inspectorId: userId, source: 'self_claim' },
        },
      }),
    ])

    const inspection = await inspectionRepository.findByWorkOrderId(workOrderId)
    return { ok: true, status: 'PENDING_INSPECTION', inspectionId: inspection?.id }
  },
}
