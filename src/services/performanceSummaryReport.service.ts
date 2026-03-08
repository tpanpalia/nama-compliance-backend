import { prisma } from '../config/database';

export interface PerformanceSummaryData {
  generatedAt: Date;
  reportId: string;
  filters: {
    regions: string[];
    years: number[];
    months: number[];
    periodLabel: string;
  };
  executiveOverview: {
    avgScore: number | null;
    totalWorkOrders: number;
    inspectedWorkOrders: number;
    pendingWorkOrders: number;
    activeContractors: number;
    pendingInspections: number;
    overdueInspections: number;
  };
  contractorRanking: Array<{
    rank: number;
    companyName: string;
    crNumber: string;
    totalWOs: number;
    avgScore: number | null;
    scoreChange: number | null;
    inspected: number;
    pending: number;
  }>;
  categoryCompliance: Array<{
    sectionName: string;
    avgScore: number;
  }>;
  scoreDistribution: {
    below75: number;
    s75to79: number;
    s80to84: number;
    s85to89: number;
    s90to94: number;
    s95to100: number;
  };
  complianceTrend: Array<{
    monthLabel: string;
    avgScore: number | null;
  }>;
  perCategoryByContractor: Array<{
    companyName: string;
    sections: Record<string, number | null>;
    overall: number | null;
  }>;
  lowestScoringItems: Array<{
    rank: number;
    itemText: string;
    sectionName: string;
    avgScore: number;
  }>;
}

type Filters = {
  years: number[];
  months: number[];
  regions: string[];
};

const RATING_POINTS: Record<string, number> = {
  COMPLIANT: 100,
  PARTIAL: 60,
  NON_COMPLIANT: 0,
};

function buildDateFilter(filters: Filters) {
  if (filters.years.length === 0) return {};

  if (filters.months.length > 0) {
    const ranges = [];
    for (const year of filters.years) {
      for (const month of filters.months) {
        ranges.push({
          submittedAt: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month, 0, 23, 59, 59),
          },
        });
      }
    }
    return { OR: ranges };
  }

  return {
    submittedAt: {
      gte: new Date(Math.min(...filters.years), 0, 1),
      lte: new Date(Math.max(...filters.years), 11, 31, 23, 59, 59),
    },
  };
}

export async function fetchPerformanceSummaryData(filters: Filters): Promise<PerformanceSummaryData> {
  const now = new Date();
  const contractorFilter =
    filters.regions.length > 0
      ? {
          contractor: {
            regions: { hasSome: filters.regions },
          },
        }
      : {};

  const baseWhere = {
    ...buildDateFilter(filters),
    ...contractorFilter,
  } as any;

  const completedWhere = {
    ...baseWhere,
    status: 'INSPECTION_COMPLETED' as const,
    overallScore: { not: null },
  } as any;

  const [allWOs, completedWOs, activeContractors, template] = await Promise.all([
    prisma.workOrder.findMany({
      where: baseWhere,
      select: {
        id: true,
        status: true,
        overallScore: true,
        scheduledDate: true,
        contractorId: true,
        submittedAt: true,
        checklist: {
          include: {
            responses: {
              include: {
                item: {
                  include: { section: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.workOrder.findMany({
      where: completedWhere,
      select: {
        id: true,
        overallScore: true,
        contractorId: true,
        submittedAt: true,
        checklist: {
          include: {
            responses: {
              include: {
                item: {
                  include: { section: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.contractor.count({
      where: {
        isActive: true,
        ...(filters.regions.length > 0 ? { regions: { hasSome: filters.regions } } : {}),
      },
    }),
    prisma.checklistTemplate.findFirst({
      where: { isActive: true },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            items: { select: { id: true } },
          },
        },
      },
    }),
  ]);

  const inspected = allWOs.filter((workOrder) => workOrder.status === 'INSPECTION_COMPLETED').length;
  const pending = allWOs.filter((workOrder) =>
    ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(workOrder.status)
  ).length;
  const overdueCount = allWOs.filter(
    (workOrder) =>
      workOrder.scheduledDate &&
      new Date(workOrder.scheduledDate) < now &&
      !['INSPECTION_COMPLETED', 'REJECTED'].includes(workOrder.status)
  ).length;

  const scores = completedWOs
    .map((workOrder) => workOrder.overallScore)
    .filter((score): score is number => score != null);
  const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

  const contractorIds = [
    ...new Set(completedWOs.map((workOrder) => workOrder.contractorId).filter(Boolean) as string[]),
  ];
  const contractors = contractorIds.length
    ? await prisma.contractor.findMany({
        where: { id: { in: contractorIds } },
        select: {
          id: true,
          companyName: true,
          crNumber: true,
        },
      })
    : [];

  const contractorRanking = contractors
    .map((contractor) => {
      const contractorCompleted = completedWOs.filter((workOrder) => workOrder.contractorId === contractor.id);
      const contractorAll = allWOs.filter((workOrder) => workOrder.contractorId === contractor.id);
      const contractorScores = contractorCompleted
        .map((workOrder) => workOrder.overallScore)
        .filter((score): score is number => score != null);
      const contractorAvg =
        contractorScores.length > 0
          ? contractorScores.reduce((sum, score) => sum + score, 0) / contractorScores.length
          : null;
      const contractorPending = contractorAll.filter((workOrder) =>
        ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(workOrder.status)
      ).length;

      return {
        companyName: contractor.companyName,
        crNumber: contractor.crNumber,
        totalWOs: contractorAll.length,
        avgScore: contractorAvg,
        scoreChange: null,
        inspected: contractorCompleted.length,
        pending: contractorPending,
      };
    })
    .filter((contractor) => contractor.avgScore != null)
    .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .map((contractor, index) => ({ ...contractor, rank: index + 1 }));

  const allResponses = completedWOs.flatMap((workOrder) => workOrder.checklist?.responses ?? []);
  const categoryCompliance = (template?.sections ?? []).map((section) => {
    const sectionResponses = allResponses.filter(
      (response) => response.item?.section?.name === section.name && response.rating != null
    );
    const avg =
      sectionResponses.length > 0
        ? sectionResponses.reduce((sum, response) => sum + (RATING_POINTS[response.rating!] ?? 0), 0) /
          sectionResponses.length
        : 0;
    return {
      sectionName: section.name,
      avgScore: avg,
    };
  });

  const scoreDistribution = {
    below75: scores.filter((score) => score < 75).length,
    s75to79: scores.filter((score) => score >= 75 && score < 80).length,
    s80to84: scores.filter((score) => score >= 80 && score < 85).length,
    s85to89: scores.filter((score) => score >= 85 && score < 90).length,
    s90to94: scores.filter((score) => score >= 90 && score < 95).length,
    s95to100: scores.filter((score) => score >= 95).length,
  };

  const complianceTrend: PerformanceSummaryData['complianceTrend'] = [];
  const yearsToQuery = filters.years.length > 0 ? [...filters.years].sort((a, b) => a - b) : [now.getFullYear()];
  const monthsToQuery =
    filters.months.length > 0 ? [...filters.months].sort((a, b) => a - b) : Array.from({ length: 12 }, (_, i) => i + 1);

  for (const year of yearsToQuery) {
    for (const month of monthsToQuery) {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);
      const monthLabel = monthStart.toLocaleString('en-US', { month: 'short', year: 'numeric' });

      const monthWOs = await prisma.workOrder.findMany({
        where: {
          status: 'INSPECTION_COMPLETED',
          overallScore: { not: null },
          submittedAt: {
            gte: monthStart,
            lte: monthEnd,
          },
          ...contractorFilter,
        } as any,
        select: { overallScore: true },
      });

      const monthScores = monthWOs
        .map((workOrder) => workOrder.overallScore)
        .filter((score): score is number => score != null);

      complianceTrend.push({
        monthLabel,
        avgScore: monthScores.length > 0 ? monthScores.reduce((sum, score) => sum + score, 0) / monthScores.length : null,
      });
    }
  }

  const perCategoryByContractor = contractors.map((contractor) => {
    const contractorCompleted = completedWOs.filter((workOrder) => workOrder.contractorId === contractor.id);
    const contractorResponses = contractorCompleted.flatMap((workOrder) => workOrder.checklist?.responses ?? []);
    const contractorScores = contractorCompleted
      .map((workOrder) => workOrder.overallScore)
      .filter((score): score is number => score != null);

    const sections: Record<string, number | null> = {};
    for (const section of template?.sections ?? []) {
      const sectionResponses = contractorResponses.filter(
        (response) => response.item?.section?.name === section.name && response.rating != null
      );
      sections[section.name] =
        sectionResponses.length > 0
          ? sectionResponses.reduce((sum, response) => sum + (RATING_POINTS[response.rating!] ?? 0), 0) /
            sectionResponses.length
          : null;
    }

    return {
      companyName: contractor.companyName,
      sections,
      overall:
        contractorScores.length > 0
          ? contractorScores.reduce((sum, score) => sum + score, 0) / contractorScores.length
          : null,
    };
  });

  const lowestScoringItems = Array.from(
    allResponses.reduce((groups, response) => {
      if (!response.rating || !response.item?.text || !response.item?.section?.name) return groups;
      const key = `${response.item.section.name}::${response.item.text}`;
      const current = groups.get(key) ?? {
        itemText: response.item.text,
        sectionName: response.item.section.name,
        scores: [] as number[],
      };
      current.scores.push(RATING_POINTS[response.rating] ?? 0);
      groups.set(key, current);
      return groups;
    }, new Map<string, { itemText: string; sectionName: string; scores: number[] }>())
  )
    .map(([, item]) => ({
      itemText: item.itemText,
      sectionName: item.sectionName,
      avgScore: item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length,
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const periodLabel = [
    filters.regions.length > 0 ? `Region: ${filters.regions.join(', ')}` : 'All Regions',
    filters.years.length > 0 ? `Year: ${filters.years.join(', ')}` : 'All Years',
    filters.months.length > 0 ? `Months: ${filters.months.map((month) => monthNames[month]).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  const reportId = `RPT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(
    Math.floor(Math.random() * 999) + 1
  ).padStart(3, '0')}`;

  return {
    generatedAt: now,
    reportId,
    filters: { ...filters, periodLabel },
    executiveOverview: {
      avgScore,
      totalWorkOrders: allWOs.length,
      inspectedWorkOrders: inspected,
      pendingWorkOrders: pending,
      activeContractors,
      pendingInspections: pending,
      overdueInspections: overdueCount,
    },
    contractorRanking,
    categoryCompliance,
    scoreDistribution,
    complianceTrend,
    perCategoryByContractor,
    lowestScoringItems,
  };
}
