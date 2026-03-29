import { dashboardRepository } from '../../repositories/dashboard.repository'

export const regulatorDashboardService = {
  get: async (from: string, to: string) => {
    const result = await dashboardRepository.getRegulatorDashboard(from, to)
    return (result[0] as Record<string, unknown>)['get_regulator_dashboard']
  },
}
