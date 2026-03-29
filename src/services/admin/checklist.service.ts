import { ChecklistCategory } from '@prisma/client'
import { AppError } from '../../middleware/errorHandler'
import { checklistRepository } from '../../repositories/checklist.repository'
import { auditLogRepository } from '../../repositories/auditLog.repository'

export const checklistService = {
  list: async (params: { active?: string; category?: string }) => {
    const where: { isActive?: boolean; category?: ChecklistCategory } = {
      ...(params.active !== undefined ? { isActive: params.active === 'true' } : {}),
      ...(params.category ? { category: params.category as ChecklistCategory } : {}),
    }
    return checklistRepository.findMany(where)
  },

  create: async (performedBy: string, data: {
    id: string
    question: string
    category: ChecklistCategory
    weight: number
    order: number
  }) => {
    const exists = await checklistRepository.findById(data.id)
    if (exists) throw new AppError(409, `Checklist item ${data.id} already exists`)

    const item = await checklistRepository.create(data)

    await auditLogRepository.create({
      performedBy,
      entityType: 'CHECKLIST',
      entityId:   item.id,
      action:     'CREATED',
      metadata:   { category: data.category, weight: data.weight },
    })

    return item
  },

  deactivate: async (performedBy: string, id: string) => {
    const item = await checklistRepository.findById(id)
    if (!item) throw new AppError(404, 'Checklist item not found')
    if (!item.isActive) throw new AppError(400, 'Item is already inactive')

    await checklistRepository.deactivate(id)

    await auditLogRepository.create({
      performedBy,
      entityType: 'CHECKLIST',
      entityId:   id,
      action:     'UPDATED',
      metadata:   { action: 'deactivated' },
    })

    return { ok: true }
  },
}
