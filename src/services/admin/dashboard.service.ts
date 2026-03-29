import { dashboardRepository } from '../../repositories/dashboard.repository'

export const adminDashboardService = {
  get: async (year: number, month: number) => {
    const result = await dashboardRepository.getAdminDashboard(year, month)
    return (result[0] as Record<string, unknown>)['get_admin_dashboard']
  },
}
