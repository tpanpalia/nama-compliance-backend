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
    search?: string
    years?: string
    months?: string
    page: number
    limit: number
  }) => {
    const skip  = (params.page - 1) * params.limit

    // Build date filter from years + months
    let dateFilter: any = undefined
    const yearList = params.years ? params.years.split(',').map(Number).filter(y => y >= 2020 && y <= 2100) : []
    const monthList = params.months ? params.months.split(',').map(Number).filter(m => m >= 1 && m <= 12) : []

    if (yearList.length > 0 && monthList.length > 0) {
      // Specific months in specific years
      const conditions: any[] = []
      for (const y of yearList) {
        for (const m of monthList) {
          const start = new Date(y, m - 1, 1)
          const end = new Date(y, m, 0)
          conditions.push({ allocationDate: { gte: start, lte: end } })
        }
      }
      dateFilter = conditions.length === 1 ? conditions[0] : { OR: conditions }
    } else if (yearList.length > 0) {
      // Full years only
      const minYear = Math.min(...yearList)
      const maxYear = Math.max(...yearList)
      dateFilter = { allocationDate: { gte: new Date(`${minYear}-01-01`), lte: new Date(`${maxYear}-12-31`) } }
    } else if (monthList.length > 0) {
      // Months only (all years) — get the range of years that have data
      const earliest = await prisma.workOrder.findFirst({ orderBy: { allocationDate: 'asc' }, select: { allocationDate: true } })
      const latest = await prisma.workOrder.findFirst({ orderBy: { allocationDate: 'desc' }, select: { allocationDate: true } })
      if (earliest && latest) {
        const startY = earliest.allocationDate.getFullYear()
        const endY = latest.allocationDate.getFullYear()
        const conditions: any[] = []
        for (let y = startY; y <= endY; y++) {
          for (const m of monthList) {
            const start = new Date(y, m - 1, 1)
            const end = new Date(y, m, 0)
            conditions.push({ allocationDate: { gte: start, lte: end } })
          }
        }
        dateFilter = conditions.length === 1 ? conditions[0] : { OR: conditions }
      }
    }

    // Use AND to combine filters that might each have OR clauses
    const andConditions: any[] = []
    if (params.status) andConditions.push({ status: params.status as WorkOrderStatus })
    if (params.contractorCr) andConditions.push({ contractorCr: params.contractorCr })
    if (params.inspectorId) andConditions.push({ assignedInspectorId: params.inspectorId })
    if (params.governorateCode) andConditions.push({ governorateCode: params.governorateCode })
    if (dateFilter) andConditions.push(dateFilter)
    if (params.search) {
      andConditions.push({
        OR: [
          { id: { contains: params.search, mode: 'insensitive' } },
          { contractorCr: { contains: params.search, mode: 'insensitive' } },
          { contractor: { companyName: { contains: params.search, mode: 'insensitive' } } },
          { assignedInspector: { staffProfile: { fullName: { contains: params.search, mode: 'insensitive' } } } },
        ],
      })
    }

    const where: any = andConditions.length > 0 ? { AND: andConditions } : {}

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
    governorateCode: string
    siteName: string
    description?: string
    priority: WorkOrderPriority
    allocationDate: string
    targetCompletionDate: string
  }) => {
    const gov = await governorateRepository.findByCode(data.governorateCode)
    if (!gov) throw new AppError(404, 'Governorate not found')

    const weights = await scoringRepository.findActive()
    if (!weights) throw new AppError(500, 'No active scoring weights found')

    const id = await generateWorkOrderId()

    const workOrder = await workOrderRepository.create({
      id,
      governorateCode:      data.governorateCode,
      siteName:             data.siteName,
      description:          data.description,
      priority:             data.priority,
      allocationDate:       new Date(data.allocationDate),
      targetCompletionDate: new Date(data.targetCompletionDate),
      scoringWeightsId:     weights.id,
      status:               'UNASSIGNED',
    })

    await auditLogRepository.create({
      performedBy,
      entityType: 'WORK_ORDER',
      entityId:   id,
      action:     'CREATED',
      metadata:   { status: 'UNASSIGNED' },
    })

    return workOrder
  },

  bulkCreate: async (performedBy: string, workOrders: {
    governorateCode: string
    siteName: string
    description?: string
    workType?: string
    priority: WorkOrderPriority
    allocationDate: string
    targetCompletionDate: string
  }[]) => {
    // Validate all governorates upfront
    const govCodes = [...new Set(workOrders.map((wo) => wo.governorateCode))]
    for (const code of govCodes) {
      const gov = await governorateRepository.findByCode(code)
      if (!gov) throw new AppError(400, `Governorate not found: ${code}`)
    }

    const weights = await scoringRepository.findActive()
    if (!weights) throw new AppError(500, 'No active scoring weights found')

    // Pre-generate all IDs sequentially to avoid conflicts
    const ids: string[] = []
    const today = new Date()
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `WO-${datePart}-`
    const last = await prisma.workOrder.findFirst({
      where: { id: { startsWith: prefix } },
      orderBy: { id: 'desc' },
      select: { id: true },
    })
    let seq = 1
    if (last) {
      const parts = last.id.split('-')
      seq = parseInt(parts[parts.length - 1], 10) + 1
    }
    for (let i = 0; i < workOrders.length; i++) {
      ids.push(`${prefix}${String(seq + i).padStart(4, '0')}`)
    }

    // Wrap all creates in a single transaction
    const results = await prisma.$transaction(async (tx) => {
      const created = []
      for (let i = 0; i < workOrders.length; i++) {
        const data = workOrders[i]
        const id = ids[i]
        const workOrder = await tx.workOrder.create({
          data: {
            id,
            governorateCode:      data.governorateCode,
            siteName:             data.siteName,
            description:          data.description,
            priority:             data.priority,
            allocationDate:       new Date(data.allocationDate),
            targetCompletionDate: new Date(data.targetCompletionDate),
            scoringWeightsId:     weights.id,
            status:               'UNASSIGNED',
          },
        })
        await tx.auditLog.create({
          data: {
            performedBy,
            entityType: 'WORK_ORDER',
            entityId:   id,
            action:     'CREATED',
            metadata:   { status: 'UNASSIGNED', bulkImport: true },
          },
        })
        created.push(workOrder)
      }
      return created
    })

    return results
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
        throw new AppError(400, `Cannot assign/reassign contractor when work order is ${wo.status}`)
      }
      const contractor = await contractorRepository.findByCr(data.contractorCr)
      if (!contractor) throw new AppError(404, 'Contractor not found')
    }

    // When assigning contractor to UNASSIGNED WO, change status to ASSIGNED
    const statusUpdate = data.contractorCr && wo.status === 'UNASSIGNED' ? { status: 'ASSIGNED' as WorkOrderStatus } : {}

    const updated = await workOrderRepository.update(workOrderId, {
      ...data,
      ...statusUpdate,
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

  reopen: async (performedBy: string, workOrderId: string, reason: string) => {
    const wo = await workOrderRepository.findById(workOrderId)
    if (!wo) throw new AppError(404, 'Work order not found')

    const allowedStatuses: WorkOrderStatus[] = ['SUBMITTED', 'PENDING_INSPECTION']
    if (!allowedStatuses.includes(wo.status)) {
      throw new AppError(400, `Cannot reopen work order when status is ${wo.status}`)
    }

    const updated = await workOrderRepository.update(workOrderId, {
      status: 'IN_PROGRESS' as WorkOrderStatus,
    })

    await auditLogRepository.create({
      performedBy,
      entityType: 'WORK_ORDER',
      entityId:   workOrderId,
      action:     'REOPENED',
      metadata:   { previousStatus: wo.status, reason },
    })

    // Notify the contractor if one is assigned
    if (wo.contractorCr) {
      const contractor = await contractorRepository.findByCr(wo.contractorCr)
      if (contractor?.userId) {
        await notificationRepository.create({
          userId:      contractor.userId,
          type:        'WORK_ORDER_ASSIGNED',
          title:       'Work Order Reopened',
          message:     `Work order ${workOrderId} has been reopened${reason ? `: ${reason}` : '.'}`,
          workOrderId,
        })
      }
    }

    return updated
  },
}
