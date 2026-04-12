import { UserStatus } from '@prisma/client'
import { AppError } from '../../middleware/errorHandler'
import { contractorRepository } from '../../repositories/contractor.repository'
import { dashboardRepository } from '../../repositories/dashboard.repository'

export const regulatorContractorService = {
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
        ],
      } : {}),
    }

    const [items, total] = await Promise.all([
      contractorRepository.findManyRegulator({ where, skip, take: params.limit }),
      contractorRepository.count(where),
    ])

    return { items, total }
  },

  getById: async (cr: string) => {
    const contractor = await contractorRepository.findByCrRegulator(cr)
    if (!contractor) throw new AppError(404, 'Contractor not found')
    return contractor
  },

  getPerformance: async (cr: string, year: number, month: number) => {
    const result = await dashboardRepository.getContractorPerformance(cr, year, month)
    return (result[0] as Record<string, unknown>)['get_contractor_performance']
  },

  getSummary: async () => {
    const result = await dashboardRepository.getContractorsSummary()
    return (result[0] as Record<string, unknown>)['get_contractors_summary']
  },
}
