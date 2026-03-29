import { prisma } from '../lib/prisma'

export const dashboardRepository = {
  getAdminDashboard: (year: number, month: number) =>
    prisma.$queryRaw<[Record<string, unknown>]>`
      SELECT get_admin_dashboard(${year}::int, ${month}::int)
    `,

  getRegulatorDashboard: (from: string, to: string) =>
    prisma.$queryRaw<[Record<string, unknown>]>`
      SELECT get_regulator_dashboard(${from}::date, ${to}::date)
    `,

  getContractorPerformance: (cr: string, year: number, month: number) =>
    prisma.$queryRaw<[Record<string, unknown>]>`
      SELECT get_contractor_performance(${cr}::text, ${year}::int, ${month}::int)
    `,

  getInspectorWorkload: (from: string, to: string) =>
    prisma.$queryRaw<[Record<string, unknown>]>`
      SELECT get_inspector_workload(${from}::date, ${to}::date)
    `,
}
