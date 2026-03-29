import { UserStatus } from '@prisma/client'
import { AppError } from '../../middleware/errorHandler'
import { contractorRepository } from '../../repositories/contractor.repository'
import { auditLogRepository } from '../../repositories/auditLog.repository'
import { dashboardRepository } from '../../repositories/dashboard.repository'

export const adminContractorService = {
  list: async (params: { status?: string; search?: string; page: number; limit: number }) => {
    const skip  = (params.page - 1) * params.limit
    const where = {
      user: {
        role: 'CONTRACTOR' as const,
        ...(params.status ? { status: params.status as UserStatus } : {}),
      },
      ...(params.search ? {
        OR: [
          { companyName: { contains: params.search, mode: 'insensitive' as const } },
          { crNumber:    { contains: params.search, mode: 'insensitive' as const } },
          { contactName: { contains: params.search, mode: 'insensitive' as const } },
          { email:       { contains: params.search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [items, total] = await Promise.all([
      contractorRepository.findMany({ where, skip, take: params.limit }),
      contractorRepository.count(where),
    ])

    return { items, total }
  },

  getById: async (cr: string) => {
    const contractor = await contractorRepository.findByCrFull(cr)
    if (!contractor) throw new AppError(404, 'Contractor not found')
    return contractor
  },

  getPerformance: async (cr: string, year: number, month: number) => {
    const result = await dashboardRepository.getContractorPerformance(cr, year, month)
    return (result[0] as Record<string, unknown>)['get_contractor_performance']
  },

  updateStatus: async (performedBy: string, cr: string, status: string, reason?: string) => {
    const contractor = await contractorRepository.findByCrWithUser(cr)
    if (!contractor) throw new AppError(404, 'Contractor not found')

    await contractorRepository.updateUserStatus(contractor.userId, status as UserStatus)

    const action = status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVATED'
    await auditLogRepository.create({
      performedBy,
      entityType: 'CONTRACTOR',
      entityId:   cr,
      action,
      metadata:   { status, reason },
    })

    return { ok: true, status }
  },
}
