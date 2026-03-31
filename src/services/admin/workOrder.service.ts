import { WorkOrderPriority, WorkOrderStatus } from '@prisma/client'
import { AppError } from '../../middleware/errorHandler'
import { workOrderRepository } from '../../repositories/workOrder.repository'
import { contractorRepository } from '../../repositories/contractor.repository'
import { governorateRepository } from '../../repositories/governorate.repository'
import { scoringRepository } from '../../repositories/scoring.repository'
import { checklistRepository } from '../../repositories/checklist.repository'
import { inspectionRepository } from '../../repositories/inspection.repository'
import { auditLogRepository } from '../../repositories/auditLog.repository'
import { notificationRepository } from '../../repositories/notification.repository'
import { userRepository } from '../../repositories/user.repository'
import { generateWorkOrderId } from '../../utils/ids'
import { prisma } from '../../lib/prisma'

export const adminWorkOrderService = {
  list: async (params: {
    status?: string
    contractorCr?: string
    inspectorId?: string
    governorateCode?: string
    page: number
    limit: number
  }) => {
    const skip  = (params.page - 1) * params.limit
    const where = {
      ...(params.status          ? { status: params.status as WorkOrderStatus }           : {}),
      ...(params.contractorCr    ? { contractorCr: params.contractorCr }                  : {}),
      ...(params.inspectorId     ? { assignedInspectorId: params.inspectorId }            : {}),
      ...(params.governorateCode ? { governorateCode: params.governorateCode }            : {}),
    }

    const [items, total] = await Promise.all([
      workOrderRepository.findMany({ where, skip, take: params.limit }),
      workOrderRepository.count(where),
    ])

    return { items, total }
  },

  getById: async (id: string) => {
    const wo = await workOrderRepository.findByIdFull(id)
    if (!wo) throw new AppError(404, 'Work order not found')
    return wo
  },

  create: async (performedBy: string, data: {
    contractorCr: string
    governorateCode: string
    siteName: string
    description?: string
    priority: WorkOrderPriority
    allocationDate: string
    targetCompletionDate: string
    assignedInspectorId?: string
  }) => {
    const contractor = await contractorRepository.findByCr(data.contractorCr)
    if (!contractor) throw new AppError(404, 'Contractor not found')

    const gov = await governorateRepository.findByCode(data.governorateCode)
    if (!gov) throw new AppError(404, 'Governorate not found')

    const weights = await scoringRepository.findActive()
    if (!weights) throw new AppError(500, 'No active scoring weights found')

    const id     = await generateWorkOrderId()
    const status: WorkOrderStatus = data.assignedInspectorId ? 'ASSIGNED' : 'UNASSIGNED'

    const workOrder = await workOrderRepository.create({
      id,
      contractorCr:         data.contractorCr,
      governorateCode:      data.governorateCode,
      siteName:             data.siteName,
      description:          data.description,
      priority:             data.priority,
      allocationDate:       new Date(data.allocationDate),
      targetCompletionDate: new Date(data.targetCompletionDate),
      scoringWeightsId:     weights.id,
      status,
      assignedInspectorId:  data.assignedInspectorId,
    })

    await auditLogRepository.create({
      performedBy,
      entityType: 'WORK_ORDER',
      entityId:   id,
      action:     'CREATED',
      metadata:   { contractorCr: data.contractorCr, status },
    })

    if (data.assignedInspectorId) {
      await notificationRepository.create({
        userId:      data.assignedInspectorId,
        type:        'WORK_ORDER_ASSIGNED',
        title:       'New Work Order Assigned',
        message:     `Work order ${id} has been assigned to you.`,
        workOrderId: id,
      })
    }

    return workOrder
  },

  assign: async (performedBy: string, workOrderId: string, inspectorId: string) => {
    const wo = await workOrderRepository.findById(workOrderId)
    if (!wo) throw new AppError(404, 'Work order not found')

    const allowedStatuses: WorkOrderStatus[] = ['UNASSIGNED', 'SUBMITTED', 'ASSIGNED']
    if (!allowedStatuses.includes(wo.status)) {
      throw new AppError(400, `Cannot assign inspector when work order is ${wo.status}`)
    }

    const inspector = await userRepository.findById(inspectorId)
    if (!inspector || inspector.role !== 'INSPECTOR' || inspector.status !== 'ACTIVE') {
      throw new AppError(400, 'Invalid or inactive inspector')
    }

    const newStatus: WorkOrderStatus = wo.status === 'SUBMITTED' ? 'PENDING_INSPECTION' : 'ASSIGNED'

    if (wo.status === 'SUBMITTED') {
      const existingInspection = await inspectionRepository.findByWorkOrderId(workOrderId)
      if (existingInspection) throw new AppError(409, 'An inspection already exists for this work order')

      const checklistVersion = await checklistRepository.findActiveVersion()
      if (!checklistVersion) throw new AppError(500, 'No active checklist version found')

      const checklistItems = await checklistRepository.findAllActive()

      await prisma.$transaction([
        prisma.workOrder.update({
          where: { id: workOrderId },
          data:  { assignedInspectorId: inspectorId, status: newStatus },
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
      ])
    } else {
      await workOrderRepository.update(workOrderId, { assignedInspectorId: inspectorId, status: newStatus })
    }

    await auditLogRepository.create({
      performedBy,
      entityType: 'WORK_ORDER',
      entityId:   workOrderId,
      action:     wo.assignedInspectorId ? 'REASSIGNED' : 'ASSIGNED',
      metadata:   { inspectorId, previousInspectorId: wo.assignedInspectorId },
    })

    await notificationRepository.create({
      userId:      inspectorId,
      type:        'WORK_ORDER_ASSIGNED',
      title:       'Work Order Assigned',
      message:     `Work order ${workOrderId} has been assigned to you.`,
      workOrderId,
    })

    return { ok: true, status: newStatus }
  },

  update: async (performedBy: string, workOrderId: string, data: {
    siteName?: string
    description?: string
    priority?: WorkOrderPriority
    targetCompletionDate?: string
    contractorCr?: string
  }) => {
    const wo = await workOrderRepository.findById(workOrderId)
    if (!wo) throw new AppError(404, 'Work order not found')

    if (data.contractorCr) {
      const allowedForReassign: WorkOrderStatus[] = ['UNASSIGNED', 'ASSIGNED']
      if (!allowedForReassign.includes(wo.status)) {
        throw new AppError(400, `Cannot reassign contractor when work order is ${wo.status}`)
      }
      const contractor = await contractorRepository.findByCr(data.contractorCr)
      if (!contractor) throw new AppError(404, 'Contractor not found')
    }

    const updated = await workOrderRepository.update(workOrderId, {
      ...data,
      ...(data.targetCompletionDate ? { targetCompletionDate: new Date(data.targetCompletionDate) } : {}),
    })

    await auditLogRepository.create({
      performedBy,
      entityType: 'WORK_ORDER',
      entityId:   workOrderId,
      action:     data.contractorCr ? 'REASSIGNED' : 'UPDATED',
      metadata:   { ...data, previousContractorCr: data.contractorCr ? wo.contractorCr : undefined },
    })

    return updated
  },
}
