import { dashboardRepository } from '../../repositories/dashboard.repository'
import { reportRepository } from '../../repositories/report.repository'
import { governorateRepository } from '../../repositories/governorate.repository'

export const adminReportService = {
  inspectorWorkload: async (from: string, to: string) => {
    const result = await dashboardRepository.getInspectorWorkload(from, to)
    return (result[0] as Record<string, unknown>)['get_inspector_workload']
  },

  exports: async (page: number, limit: number) => {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      reportRepository.findManyExports(skip, limit),
      reportRepository.countExports(),
    ])
    return { items, total }
  },

  governorates: async () => governorateRepository.findAll(),
}
