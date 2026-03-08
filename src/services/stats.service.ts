import { prisma } from '../config/database';
import { ACTIVE_WO_STATUSES, activeProjectsFilter, getOverdueFilter } from '../utils/queryHelpers';

interface DashboardFilters {
  year?: number;
  month?: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  const currentDateFilter = { createdAt: current };
  const previousDateFilter = { createdAt: previous };
  const year = filters.year || new Date().getFullYear();

  const [currentInspections, previousInspections] = await Promise.all([
    prisma.workOrder.count({
      where: { status: 'INSPECTION_COMPLETED', ...currentDateFilter },
    }),
    prisma.workOrder.count({
      where: { status: 'INSPECTION_COMPLETED', ...previousDateFilter },
    }),
  ]);
  const inspectionTrend = computeTrend(currentInspections, previousInspections);

  const [currentActiveContractors, previousActiveContractors] = await Promise.all([
    prisma.contractor.count({
      where: {
        isActive: true,
        workOrders: { some: { status: { in: [...ACTIVE_WO_STATUSES] }, ...currentDateFilter } },
      },
    }),
    prisma.contractor.count({
      where: {
        isActive: true,
        workOrders: {
          some: {
            status: { in: [...ACTIVE_WO_STATUSES] },
            ...previousDateFilter,
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

  const rawMonthlyTrend = await prisma.$queryRaw<Array<{ month: number; inspections: number; avgCompliance: number | null }>>`
    SELECT
      EXTRACT(MONTH FROM "approvedAt")::int            as month,
      COUNT(*)::int                                    as inspections,
      ROUND(AVG(
        CASE WHEN "overallScore" IS NOT NULL THEN "overallScore" ELSE NULL END
      )::numeric, 1)::float                           as "avgCompliance"
    FROM "WorkOrder"
    WHERE
      status = 'INSPECTION_COMPLETED'
      AND "approvedAt" >= ${new Date(year, 0, 1)}
      AND "approvedAt" <= ${new Date(year, 11, 31, 23, 59, 59)}
    GROUP BY EXTRACT(MONTH FROM "approvedAt")
    ORDER BY EXTRACT(MONTH FROM "approvedAt") ASC
  `;

  const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const found = rawMonthlyTrend.find((entry) => entry.month === month);
    return {
      month,
      monthLabel: MONTH_LABELS[index],
      inspections: found?.inspections ?? 0,
      avgCompliance: found?.avgCompliance ?? null,
    };
  });

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

  const [activeContractorRows, completedWOs] = await Promise.all([
    prisma.contractor.findMany({
      where: { isActive: true },
      include: {
        workOrders: {
          where: activeProjectsFilter as any,
          select: { id: true },
        },
      },
    }),
    prisma.workOrder.findMany({
      where: {
        status: 'INSPECTION_COMPLETED',
        overallScore: { not: null },
        approvedAt: current,
      },
      select: {
        contractorId: true,
        overallScore: true,
      },
    }),
  ]);

  const scoresByContractor: Record<string, number[]> = {};
  for (const workOrder of completedWOs) {
    if (!workOrder.contractorId || workOrder.overallScore == null) continue;
    if (!scoresByContractor[workOrder.contractorId]) {
      scoresByContractor[workOrder.contractorId] = [];
    }
    scoresByContractor[workOrder.contractorId].push(workOrder.overallScore);
  }

  const topContractors = (activeContractorRows as unknown as Array<{ id: string; companyName: string; workOrders: Array<{ id: string }> }>)
    .map((contractor) => {
      const scores = scoresByContractor[contractor.id] ?? [];
      const avgScore =
        scores.length > 0 ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 : null;

      return {
        id: contractor.id,
        companyName: contractor.companyName,
        activeProjects: contractor.workOrders.length,
        avgScore,
      };
    })
    .filter((contractor) => contractor.avgScore != null)
    .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .slice(0, 5)
    .map((contractor) => ({
      ...contractor,
      trend: 0,
    }));

  const alerts: string[] = [];

  const overdueCount = await prisma.workOrder.count({
    where: getOverdueFilter(),
  });
  if (overdueCount > 0) {
    alerts.push(`${overdueCount} work order${overdueCount !== 1 ? 's are' : ' is'} overdue for inspection`);
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
