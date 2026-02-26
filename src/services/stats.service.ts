import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

type MonthlyTrendRow = {
  month: string;
  inspectionCount: number;
  avgCompliance: number | null;
};

type ComplianceByCategoryRow = {
  sectionName: string;
  avgScore: number | null;
};

type TopContractorRow = {
  contractorId: string;
  companyName: string;
  totalInspections: number;
  avgScore: number | null;
};

export async function getAdminDashboard() {
  const [totalWorkOrders, activeContractors, pendingReviews, avgResult, monthlyTrend, complianceByCategory] =
    await Promise.all([
      prisma.workOrder.count(),
      prisma.contractor.count({ where: { isActive: true } }),
      prisma.workOrder.count({ where: { status: 'SUBMITTED' } }),
      prisma.workOrder.aggregate({
        where: { status: 'APPROVED', overallScore: { not: null } },
        _avg: { overallScore: true },
      }),
      prisma.$queryRaw<MonthlyTrendRow[]>`
        SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') as month,
               COUNT(*)::int as "inspectionCount",
               ROUND(AVG("overallScore")::numeric, 1)::float as "avgCompliance"
        FROM "WorkOrder"
        WHERE "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY DATE_TRUNC('month', "createdAt") ASC
      `,
      prisma.$queryRaw<ComplianceByCategoryRow[]>`
        SELECT cs.name as "sectionName",
               ROUND(AVG(CASE cr.rating
                 WHEN 'COMPLIANT'     THEN 100
                 WHEN 'PARTIAL'       THEN 67
                 WHEN 'NON_COMPLIANT' THEN 33
                 ELSE NULL END)::numeric, 1)::float as "avgScore"
        FROM "ChecklistResponse" cr
        JOIN "ChecklistItem"    ci ON cr."itemId"    = ci.id
        JOIN "ChecklistSection" cs ON ci."sectionId" = cs.id
        WHERE cr.rating IS NOT NULL
        GROUP BY cs.name
      `,
    ]);

  return {
    totalWorkOrders,
    activeContractors,
    pendingReviews,
    avgCompliance: Math.round((avgResult._avg.overallScore || 0) * 10) / 10,
    monthlyTrend,
    complianceByCategory,
  };
}

export async function getInspectorDashboard(inspectorId: string) {
  if (!inspectorId) throw new AppError('Inspector user not resolved', 400);

  const [assigned, inProgress, completed, avgResult] = await Promise.all([
    prisma.workOrder.count({ where: { inspectorId, status: 'ASSIGNED' } }),
    prisma.workOrder.count({ where: { inspectorId, status: 'IN_PROGRESS' } }),
    prisma.workOrder.count({ where: { inspectorId, status: { in: ['SUBMITTED', 'APPROVED'] } } }),
    prisma.workOrder.aggregate({
      where: { inspectorId, overallScore: { not: null } },
      _avg: { overallScore: true },
    }),
  ]);

  return {
    assigned,
    inProgress,
    completed,
    avgScore: Math.round((avgResult._avg.overallScore || 0) * 10) / 10,
  };
}

export async function getContractorDashboard(contractorId: string) {
  if (!contractorId) throw new AppError('Contractor user not resolved', 400);

  const [assigned, submitted, completed, avgResult] = await Promise.all([
    prisma.workOrder.count({ where: { contractorId, status: 'ASSIGNED' } }),
    prisma.workOrder.count({ where: { contractorId, status: 'SUBMITTED' } }),
    prisma.workOrder.count({ where: { contractorId, status: 'APPROVED' } }),
    prisma.workOrder.aggregate({
      where: { contractorId, overallScore: { not: null } },
      _avg: { overallScore: true },
    }),
  ]);

  return {
    assigned,
    submitted,
    completed,
    avgScore: Math.round((avgResult._avg.overallScore || 0) * 10) / 10,
  };
}

export async function getRegulatorDashboard() {
  const [systemTotal, systemAvg, pendingReviews, topContractors] = await Promise.all([
    prisma.workOrder.count(),
    prisma.workOrder.aggregate({
      where: { overallScore: { not: null } },
      _avg: { overallScore: true },
    }),
    prisma.workOrder.count({ where: { status: 'SUBMITTED' } }),
    prisma.$queryRaw<TopContractorRow[]>`
      SELECT c."contractorId", c."companyName",
             COUNT(wo.id)::int as "totalInspections",
             ROUND(AVG(wo."overallScore")::numeric, 1)::float as "avgScore"
      FROM "Contractor" c
      JOIN "WorkOrder" wo ON wo."contractorId" = c.id
      WHERE wo."overallScore" IS NOT NULL
      GROUP BY c.id, c."contractorId", c."companyName"
      HAVING COUNT(wo.id) >= 1
      ORDER BY AVG(wo."overallScore") DESC
      LIMIT 5
    `,
  ]);

  return {
    systemTotal,
    systemAvgCompliance: Math.round((systemAvg._avg.overallScore || 0) * 10) / 10,
    pendingReviews,
    topContractors,
  };
}
