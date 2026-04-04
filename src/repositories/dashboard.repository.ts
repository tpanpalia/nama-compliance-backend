import { prisma } from '../lib/prisma'

export const dashboardRepository = {
  getYearRange: () =>
    prisma.$queryRaw<[{ min_year: number; max_year: number }]>`
      SELECT COALESCE(EXTRACT(YEAR FROM MIN(allocation_date))::int, EXTRACT(YEAR FROM NOW())::int) AS min_year,
             COALESCE(EXTRACT(YEAR FROM MAX(allocation_date))::int, EXTRACT(YEAR FROM NOW())::int) AS max_year
      FROM work_orders
    `,

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

  getContractorsSummary: () =>
    prisma.$queryRaw<[Record<string, unknown>]>`
      SELECT get_contractors_summary()
    `,
}
