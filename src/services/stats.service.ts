import { prisma } from '../config/database';

interface DashboardFilters {
  year?: number;
  month?: number;
}

function buildDateRange(filters: DashboardFilters): {
  current: { gte: Date; lte: Date };
  previous: { gte: Date; lte: Date };
} {
  const now = new Date();
  const year = filters.year || now.getFullYear();
  const month = filters.month;

  let currentGte: Date;
  let currentLte: Date;
  let previousGte: Date;
  let previousLte: Date;

  if (month) {
    currentGte = new Date(year, month - 1, 1);
    currentLte = new Date(year, month, 0, 23, 59, 59);
    previousGte = new Date(year - 1, month - 1, 1);
    previousLte = new Date(year - 1, month, 0, 23, 59, 59);
  } else {
    currentGte = new Date(year, 0, 1);
    currentLte = new Date(year, 11, 31, 23, 59, 59);
    previousGte = new Date(year - 1, 0, 1);
    previousLte = new Date(year - 1, 11, 31, 23, 59, 59);
  }

  return {
    current: { gte: currentGte, lte: currentLte },
    previous: { gte: previousGte, lte: previousLte },
  };
}

function computeTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

export async function getAdminDashboard(filters: DashboardFilters) {
  const { current, previous } = buildDateRange(filters);

  const [currentInspections, previousInspections] = await Promise.all([
    prisma.workOrder.count({
      where: { status: { in: ['SUBMITTED', 'INSPECTION_COMPLETED'] }, createdAt: current },
    }),
    prisma.workOrder.count({
      where: { status: { in: ['SUBMITTED', 'INSPECTION_COMPLETED'] }, createdAt: previous },
    }),
  ]);
  const inspectionTrend = computeTrend(currentInspections, previousInspections);

  const [currentActiveContractors, previousActiveContractors] = await Promise.all([
    prisma.contractor.count({
      where: {
        isActive: true,
        workOrders: { some: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } },
      },
    }),
    prisma.contractor.count({
      where: {
        isActive: true,
        workOrders: {
          some: {
            status: { in: ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'INSPECTION_COMPLETED'] },
            createdAt: previous,
          },
        },
      },
    }),
  ]);
  const contractorTrend = currentActiveContractors - previousActiveContractors;

  const [currentAvg, previousAvg] = await Promise.all([
    prisma.workOrder.aggregate({
      where: {
        status: 'INSPECTION_COMPLETED',
        overallScore: { not: null },
        approvedAt: current,
      },
      _avg: { overallScore: true },
    }),
    prisma.workOrder.aggregate({
      where: {
        status: 'INSPECTION_COMPLETED',
        overallScore: { not: null },
        approvedAt: previous,
      },
      _avg: { overallScore: true },
    }),
  ]);
  const avgCompliance = Math.round((currentAvg._avg.overallScore || 0) * 10) / 10;
  const prevAvgCompliance = Math.round((previousAvg._avg.overallScore || 0) * 10) / 10;
  const complianceTrend = Math.round((avgCompliance - prevAvgCompliance) * 10) / 10;

  const monthlyTrend = await prisma.$queryRaw<Array<{ month: string; inspectionCount: number; avgCompliance: number }>>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon') as month,
      DATE_TRUNC('month', "createdAt")                 as "monthDate",
      COUNT(*)::int                                     as "inspectionCount",
      ROUND(AVG(
        CASE WHEN "overallScore" IS NOT NULL THEN "overallScore" ELSE NULL END
      )::numeric, 1)::float                            as "avgCompliance"
    FROM "WorkOrder"
    WHERE
      "createdAt" >= NOW() - INTERVAL '6 months'
      AND status IN ('SUBMITTED', 'INSPECTION_COMPLETED')
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY DATE_TRUNC('month', "createdAt") ASC
  `;

  const categoryData = await prisma.$queryRaw<Array<{ sectionName: string; avgScore: number }>>`
    SELECT
      cs.name                                         as "sectionName",
      ROUND(AVG(
        CASE cr.rating
          WHEN 'COMPLIANT'     THEN 100
          WHEN 'PARTIAL'       THEN 50
          WHEN 'NON_COMPLIANT' THEN 0
          ELSE NULL
        END
      )::numeric, 1)::float                           as "avgScore"
    FROM "ChecklistResponse" cr
    JOIN "ChecklistItem"     ci ON cr."itemId"    = ci.id
    JOIN "ChecklistSection"  cs ON ci."sectionId" = cs.id
    JOIN "WorkOrderChecklist" woc ON cr."checklistId" = woc.id
    JOIN "WorkOrder"         wo  ON woc."workOrderId" = wo.id
    WHERE
      cr.rating IS NOT NULL
      AND wo."createdAt" >= ${current.gte}
      AND wo."createdAt" <= ${current.lte}
    GROUP BY cs.name, cs.order
    ORDER BY cs.order ASC
  `;

  const recentInspections = await prisma.workOrder.findMany({
    where: {
      status: { in: ['SUBMITTED', 'INSPECTION_COMPLETED'] },
    },
    include: {
      site: { select: { name: true } },
      contractor: { select: { companyName: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 4,
  });

  const topContractors = await prisma.$queryRaw<
    Array<{ id: string; companyName: string; avgScore: number; activeProjects: number; trend: number }>
  >`
    WITH contractor_scores AS (
      SELECT
        c.id,
        c."companyName",
        ROUND(AVG(wo."overallScore")::numeric, 1)::float as "avgScore",
        COUNT(CASE WHEN wo.status IN ('ASSIGNED', 'IN_PROGRESS')
                   THEN 1 END)::int                       as "activeProjects"
      FROM "Contractor" c
      JOIN "WorkOrder"  wo ON wo."contractorId" = c.id
      WHERE
        wo."overallScore" IS NOT NULL
        AND c."isActive" = true
      GROUP BY c.id, c."companyName"
      HAVING COUNT(wo.id) >= 1
    ),
    current_scores AS (
      SELECT
        c.id,
        ROUND(AVG(wo."overallScore")::numeric, 1)::float as "currentAvg"
      FROM "Contractor" c
      JOIN "WorkOrder"  wo ON wo."contractorId" = c.id
      WHERE
        wo."overallScore" IS NOT NULL
        AND wo."approvedAt" >= NOW() - INTERVAL '1 month'
      GROUP BY c.id
    ),
    previous_scores AS (
      SELECT
        c.id,
        ROUND(AVG(wo."overallScore")::numeric, 1)::float as "previousAvg"
      FROM "Contractor" c
      JOIN "WorkOrder"  wo ON wo."contractorId" = c.id
      WHERE
        wo."overallScore" IS NOT NULL
        AND wo."approvedAt" >= NOW() - INTERVAL '2 months'
        AND wo."approvedAt" <  NOW() - INTERVAL '1 month'
      GROUP BY c.id
    )
    SELECT
      cs.id,
      cs."companyName",
      cs."avgScore",
      cs."activeProjects",
      ROUND((COALESCE(cur."currentAvg", cs."avgScore") -
             COALESCE(prev."previousAvg", cs."avgScore"))::numeric, 1)::float as trend
    FROM contractor_scores cs
    LEFT JOIN current_scores  cur  ON cur.id  = cs.id
    LEFT JOIN previous_scores prev ON prev.id = cs.id
    ORDER BY cs."avgScore" DESC
    LIMIT 4
  `;

  const alerts: string[] = [];

  const overdueCount = await prisma.workOrder.count({
    where: {
      status: 'IN_PROGRESS',
      scheduledDate: { lt: new Date() },
    },
  });
  if (overdueCount > 0) {
    alerts.push(`${overdueCount} site${overdueCount > 1 ? 's' : ''} have overdue inspections`);
  }

  const allContractorAvgs = await prisma.workOrder.groupBy({
    by: ['contractorId'],
    where: { status: 'INSPECTION_COMPLETED', overallScore: { not: null } },
    _avg: { overallScore: true },
  });

  const belowThresholdContractors = await Promise.all(
    allContractorAvgs
      .filter((c) => (c._avg.overallScore || 0) < 70)
      .map(async (c) => {
        const contractor = await prisma.contractor.findUnique({
          where: { id: c.contractorId! },
          select: { companyName: true, isActive: true },
        });
        return contractor?.isActive ? contractor.companyName : null;
      })
  );
  const activeBelow = belowThresholdContractors.filter(Boolean);
  if (activeBelow.length === 1) {
    alerts.push(`${activeBelow[0]} compliance dropped below 70%`);
  } else if (activeBelow.length > 1) {
    alerts.push(`${activeBelow.length} contractors compliance dropped below 70%`);
  }

  return {
    kpis: {
      totalInspections: { value: currentInspections, trend: inspectionTrend, trendType: 'percent' },
      activeContractors: { value: currentActiveContractors, trend: contractorTrend, trendType: 'absolute' },
      avgCompliance: { value: avgCompliance, trend: complianceTrend, trendType: 'percent' },
    },
    monthlyTrend,
    complianceByCategory: categoryData,
    recentInspections: recentInspections.map((wo) => ({
      id: wo.id,
      siteName: wo.site?.name || '-',
      contractorName: wo.contractor?.companyName || '-',
      date: wo.updatedAt,
      status: wo.status,
      score: wo.overallScore,
    })),
    topContractors,
    alerts,
  };
}

export async function getRegulatorDashboard() {
  const [systemTotal, systemAvg, pendingReviews] = await Promise.all([
    prisma.workOrder.count(),
    prisma.workOrder.aggregate({
      where: { overallScore: { not: null } },
      _avg: { overallScore: true },
    }),
    prisma.workOrder.count({ where: { status: 'SUBMITTED' } }),
  ]);

  const topContractors = await prisma.$queryRaw<
    Array<{ contractorId: string; companyName: string; totalInspections: number; avgScore: number }>
  >`
    SELECT
      c."contractorId",
      c."companyName",
      COUNT(wo.id)::int                              as "totalInspections",
      ROUND(AVG(wo."overallScore")::numeric, 1)::float as "avgScore"
    FROM "Contractor" c
    JOIN "WorkOrder"  wo ON wo."contractorId" = c.id
    WHERE wo."overallScore" IS NOT NULL
    GROUP BY c.id, c."contractorId", c."companyName"
    ORDER BY AVG(wo."overallScore") DESC
    LIMIT 5
  `;

  const complianceTrend = await prisma.$queryRaw<Array<{ month: string; avgCompliance: number }>>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') as month,
      ROUND(AVG("overallScore")::numeric, 1)::float         as "avgCompliance"
    FROM "WorkOrder"
    WHERE "createdAt" >= NOW() - INTERVAL '6 months'
      AND "overallScore" IS NOT NULL
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY DATE_TRUNC('month', "createdAt") ASC
  `;

  return {
    systemTotal,
    systemAvgCompliance: Math.round((systemAvg._avg.overallScore || 0) * 10) / 10,
    pendingReviews,
    topContractors,
    complianceTrend,
  };
}

export async function getInspectorDashboard(inspectorId: string) {
  const [assigned, inProgress, completed, avgResult] = await Promise.all([
    prisma.workOrder.count({ where: { inspectorId, status: 'ASSIGNED' } }),
    prisma.workOrder.count({ where: { inspectorId, status: 'IN_PROGRESS' } }),
    prisma.workOrder.count({ where: { inspectorId, status: { in: ['SUBMITTED', 'INSPECTION_COMPLETED'] } } }),
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
  const [assigned, inProgress, submitted, completed, avgResult] = await Promise.all([
    prisma.workOrder.count({ where: { contractorId, status: 'ASSIGNED' } }),
    prisma.workOrder.count({ where: { contractorId, status: 'IN_PROGRESS' } }),
    prisma.workOrder.count({ where: { contractorId, status: 'SUBMITTED' } }),
    prisma.workOrder.count({ where: { contractorId, status: 'INSPECTION_COMPLETED' } }),
    prisma.workOrder.aggregate({
      where: { contractorId, overallScore: { not: null } },
      _avg: { overallScore: true },
    }),
  ]);

  return {
    assigned,
    inProgress,
    submitted,
    completed,
    avgScore: Math.round((avgResult._avg.overallScore || 0) * 10) / 10,
  };
}
