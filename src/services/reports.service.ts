import { WorkOrderStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { generateAccessibleObjectUrl } from './storage.service';

export const WorkOrderReportSchema = z.object({
  workOrderId: z.string().uuid(),
});

export const ContractorReportSchema = z.object({
  contractorId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const SystemSummaryReportSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2030).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const POINTS: Record<string, number> = {
  COMPLIANT: 100,
  PARTIAL: 50,
  NON_COMPLIANT: 0,
};

type ContractorPerformanceWorkOrder = {
  id: string;
  reference: string;
  title: string;
  status: 'SUBMITTED' | 'INSPECTION_COMPLETED';
  priority: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  overallScore: number | null;
  complianceBand: string | null;
  contractorId: string | null;
  site: { name: string; location: string; region: string } | null;
  contractor: { id: string; contractorId: string; companyName: string; crNumber: string } | null;
  inspector: { id: string; displayName: string } | null;
};

function scoreColor(score: number): string {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'FAIR';
  return 'POOR';
}

function buildDateFilter(years: number[], months: number[]) {
  if (years.length === 0) return {};

  if (months.length > 0) {
    const dateRanges = [];
    for (const year of years) {
      for (const month of months) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);
        dateRanges.push({ submittedAt: { gte: start, lte: end } });
      }
    }
    return { OR: dateRanges };
  }

  const dateRanges = years.map((year) => ({
    submittedAt: {
      gte: new Date(year, 0, 1),
      lte: new Date(year, 11, 31, 23, 59, 59),
    },
  }));

  return dateRanges.length === 1 ? dateRanges[0] : { OR: dateRanges };
}

export async function getWorkOrderReportData(workOrderId: string) {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      site: { select: { name: true, location: true } },
      contractor: {
        select: {
          companyName: true,
          crNumber: true,
          contractorId: true,
          phone: true,
          address: true,
          identity: { select: { email: true } },
        },
      },
      inspector: {
        select: { displayName: true, identity: { select: { email: true } } },
      },
      createdBy: { select: { displayName: true } },
      approvedBy: { select: { displayName: true } },
      evidence: {
        select: {
          id: true,
          type: true,
          source: true,
          s3Key: true,
          capturedAt: true,
        },
      },
      checklist: {
        include: {
          responses: {
            include: {
              item: {
                include: {
                  section: {
                    select: {
                      id: true,
                      name: true,
                      weight: true,
                      order: true,
                    },
                  },
                },
              },
            },
            orderBy: [
              { item: { section: { order: 'asc' } } },
              { item: { order: 'asc' } },
            ],
          },
        },
      },
    },
  });

  if (!wo) throw new AppError('Work order not found', 404);
  if (wo.status !== 'INSPECTION_COMPLETED') {
    throw new AppError('Only completed inspections can generate inspection reports', 400);
  }

  const contractorEvidence = await Promise.all(
    wo.evidence
      .filter((e) => e.source === 'CONTRACTOR')
      .map(async (e) => ({
        id: e.id,
        fileUrl: await generateAccessibleObjectUrl(e.s3Key, null),
        capturedAt: e.capturedAt?.toISOString() || null,
      }))
  );
  const inspectorEvidence = await Promise.all(
    wo.evidence
      .filter((e) => e.source === 'INSPECTOR')
      .map(async (e) => ({
        id: e.id,
        fileUrl: await generateAccessibleObjectUrl(e.s3Key, null),
      }))
  );

  const sectionMap: Record<
    string,
    {
      sectionId: string;
      sectionName: string;
      weight: number;
      order: number;
      sectionScore: number;
      items: Array<{
        itemId: string;
        itemText: string;
        itemOrder: number;
        rating: string | null;
        comment: string | null;
        contractorEvidence: Array<{ id: string; fileUrl: string | null; capturedAt: string | null }>;
        inspectorEvidence: Array<{ id: string; fileUrl: string | null }>;
      }>;
    }
  > = {};

  if (wo.checklist) {
    for (const r of wo.checklist.responses) {
      const s = r.item.section;
      if (!sectionMap[s.id]) {
        sectionMap[s.id] = {
          sectionId: s.id,
          sectionName: s.name,
          weight: s.weight,
          order: s.order,
          sectionScore: 0,
          items: [],
        };
      }

      // Current schema stores evidence at work-order level, not per response.
      sectionMap[s.id].items.push({
        itemId: r.item.id,
        itemText: r.item.text,
        itemOrder: r.item.order,
        rating: r.rating,
        comment: r.comment,
        contractorEvidence,
        inspectorEvidence,
      });
    }
  }

  const sections = Object.values(sectionMap)
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const items = section.items.sort((a, b) => a.itemOrder - b.itemOrder);
      const rated = items.filter((i) => i.rating);
      const sum = rated.reduce((acc, i) => acc + (POINTS[i.rating!] || 0), 0);
      const score = rated.length > 0 ? Math.round(sum / rated.length) : 0;
      return { ...section, items, sectionScore: score };
    });

  return {
    reportType: 'WORK_ORDER_INSPECTION',
    generatedAt: new Date().toISOString(),
    workOrder: {
      id: wo.id,
      reference: wo.reference,
      title: wo.title,
      overallScore: wo.overallScore,
      complianceBand: wo.complianceBand || scoreColor(wo.overallScore || 0),
      isLocked: wo.isLocked,
      createdAt: wo.createdAt.toISOString(),
      submittedAt: wo.submittedAt?.toISOString() || null,
      approvedAt: wo.approvedAt?.toISOString() || null,
    },
    site: {
      name: wo.site.name,
      address: wo.site.location,
    },
    contractor: wo.contractor
      ? {
          companyName: wo.contractor.companyName,
          crNumber: wo.contractor.crNumber,
          contractorId: wo.contractor.contractorId,
          phone: wo.contractor.phone,
          email: wo.contractor.identity?.email || null,
          address: wo.contractor.address,
        }
      : null,
    inspector: wo.inspector
      ? {
          displayName: wo.inspector.displayName,
          email: wo.inspector.identity?.email || null,
        }
      : null,
    approvedBy: wo.approvedBy?.displayName || null,
    sections,
    summary: {
      totalItems: sections.flatMap((s) => s.items).length,
      compliantCount: sections.flatMap((s) => s.items).filter((i) => i.rating === 'COMPLIANT').length,
      partialCount: sections.flatMap((s) => s.items).filter((i) => i.rating === 'PARTIAL').length,
      nonCompliantCount: sections.flatMap((s) => s.items).filter((i) => i.rating === 'NON_COMPLIANT').length,
    },
  };
}

export async function getContractorReportData(contractorId: string, startDate?: string, endDate?: string) {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    include: { identity: { select: { email: true } } },
  });
  if (!contractor) throw new AppError('Contractor not found', 404);

  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const workOrders = await prisma.workOrder.findMany({
    where: {
      contractorId,
      status: 'INSPECTION_COMPLETED',
      overallScore: { not: null },
      ...(Object.keys(dateFilter).length > 0 && { approvedAt: dateFilter }),
    },
    include: {
      site: { select: { name: true } },
      inspector: { select: { displayName: true } },
      checklist: {
        include: {
          responses: {
            include: {
              item: {
                include: {
                  section: { select: { name: true, order: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { approvedAt: 'desc' },
  });

  const total = workOrders.length;
  const avgScore =
    total > 0 ? Math.round((workOrders.reduce((sum, wo) => sum + (wo.overallScore || 0), 0) / total) * 10) / 10 : 0;

  const bandCounts = { EXCELLENT: 0, GOOD: 0, FAIR: 0, POOR: 0 };
  workOrders.forEach((wo) => {
    const band = wo.complianceBand || scoreColor(wo.overallScore || 0);
    if (band in bandCounts) bandCounts[band as keyof typeof bandCounts] += 1;
  });

  const compliantCount = bandCounts.EXCELLENT + bandCounts.GOOD;
  const partialCount = bandCounts.FAIR;
  const nonCompliantCount = bandCounts.POOR;

  const monthlyMap: Record<string, { sum: number; count: number }> = {};
  workOrders.forEach((wo) => {
    if (!wo.approvedAt) return;
    const key = wo.approvedAt.toISOString().slice(0, 7);
    if (!monthlyMap[key]) monthlyMap[key] = { sum: 0, count: 0 };
    monthlyMap[key].sum += wo.overallScore || 0;
    monthlyMap[key].count += 1;
  });

  const monthlyTrend = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, val]) => {
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return {
        month: date.toLocaleString('en', { month: 'short', year: '2-digit' }),
        avgScore: Math.round((val.sum / val.count) * 10) / 10,
        count: val.count,
      };
    });

  const categoryMap: Record<string, { sum: number; count: number; order: number }> = {};
  workOrders.forEach((wo) => {
    wo.checklist?.responses.forEach((r) => {
      const section = r.item.section;
      if (!categoryMap[section.name]) {
        categoryMap[section.name] = { sum: 0, count: 0, order: section.order };
      }
      if (r.rating) {
        categoryMap[section.name].sum += POINTS[r.rating] || 0;
        categoryMap[section.name].count += 1;
      }
    });
  });

  const categoryBreakdown = Object.entries(categoryMap)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([name, val]) => ({
      name,
      avgScore: val.count ? Math.round((val.sum / val.count) * 10) / 10 : 0,
    }));

  const inspectionHistory = workOrders.slice(0, 30).map((wo) => ({
    reference: wo.reference,
    siteName: wo.site?.name || '-',
    inspectorName: wo.inspector?.displayName || '-',
    approvedAt: wo.approvedAt?.toISOString() || null,
    overallScore: wo.overallScore,
    complianceBand: wo.complianceBand || scoreColor(wo.overallScore || 0),
  }));

  return {
    reportType: 'CONTRACTOR_PERFORMANCE',
    generatedAt: new Date().toISOString(),
    period: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    contractor: {
      companyName: contractor.companyName,
      crNumber: contractor.crNumber,
      contractorId: contractor.contractorId,
      email: contractor.identity?.email || null,
      phone: contractor.phone,
      address: contractor.address,
      registeredAt: contractor.createdAt.toISOString(),
      isActive: contractor.isActive,
    },
    summary: {
      totalInspections: total,
      avgCompliance: avgScore,
      complianceBand: scoreColor(avgScore),
      compliantCount,
      partialCount,
      nonCompliantCount,
      compliantPct: total ? Math.round((compliantCount / total) * 100) : 0,
      partialPct: total ? Math.round((partialCount / total) * 100) : 0,
      nonCompliantPct: total ? Math.round((nonCompliantCount / total) * 100) : 0,
    },
    monthlyTrend,
    categoryBreakdown,
    inspectionHistory,
  };
}

export async function getSystemSummaryReportData(year?: number, month?: number) {
  const now = new Date();
  const reportYear = year || now.getFullYear();
  const dateFilter: any = {};

  if (month) {
    dateFilter.gte = new Date(reportYear, month - 1, 1);
    dateFilter.lte = new Date(reportYear, month, 0, 23, 59, 59);
  } else {
    dateFilter.gte = new Date(reportYear, 0, 1);
    dateFilter.lte = new Date(reportYear, 11, 31, 23, 59, 59);
  }

  const [totalInspections, totalContractors, activeContractors, avgResult, statusBreakdown] = await Promise.all([
    prisma.workOrder.count({
      where: { createdAt: dateFilter },
    }),
    prisma.contractor.count(),
    prisma.contractor.count({ where: { isActive: true } }),
    prisma.workOrder.aggregate({
      where: {
        status: 'INSPECTION_COMPLETED',
        overallScore: { not: null },
        approvedAt: dateFilter,
      },
      _avg: { overallScore: true },
    }),
    prisma.workOrder.groupBy({
      by: ['status'],
      where: { createdAt: dateFilter },
      _count: { status: true },
    }),
  ]);

  const avgCompliance = Math.round((avgResult._avg.overallScore || 0) * 10) / 10;

  const monthlyTrend = await prisma.$queryRaw<Array<{ month: string; inspectionCount: number; avgScore: number }>>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', "approvedAt"), 'Mon YY') as month,
      COUNT(*)::int                                         as "inspectionCount",
      ROUND(AVG("overallScore")::numeric, 1)::float        as "avgScore"
    FROM "WorkOrder"
    WHERE
      status = 'INSPECTION_COMPLETED'
      AND "approvedAt" >= ${dateFilter.gte}
      AND "approvedAt" <= ${dateFilter.lte}
    GROUP BY DATE_TRUNC('month', "approvedAt")
    ORDER BY DATE_TRUNC('month', "approvedAt") ASC
  `;

  const contractorPerformance = await prisma.$queryRaw<
    Array<{
      contractorId: string;
      companyName: string;
      crNumber: string;
      totalInspections: number;
      avgScore: number;
      belowThreshold: boolean;
    }>
  >`
    SELECT
      c."contractorId",
      c."companyName",
      c."crNumber",
      COUNT(wo.id)::int                                 as "totalInspections",
      ROUND(AVG(wo."overallScore")::numeric, 1)::float as "avgScore",
      (AVG(wo."overallScore") < 70)::boolean           as "belowThreshold"
    FROM "Contractor" c
    JOIN "WorkOrder" wo ON wo."contractorId" = c.id
    WHERE
      wo.status = 'INSPECTION_COMPLETED'
      AND wo."overallScore" IS NOT NULL
      AND wo."approvedAt" >= ${dateFilter.gte}
      AND wo."approvedAt" <= ${dateFilter.lte}
    GROUP BY c.id, c."contractorId", c."companyName", c."crNumber"
    ORDER BY AVG(wo."overallScore") DESC
  `;

  const categoryBreakdown = await prisma.$queryRaw<Array<{ sectionName: string; avgScore: number; itemCount: number }>>`
    SELECT
      cs.name                                                as "sectionName",
      ROUND(AVG(
        CASE cr.rating
          WHEN 'COMPLIANT'     THEN 100
          WHEN 'PARTIAL'       THEN 50
          WHEN 'NON_COMPLIANT' THEN 0
        END
      )::numeric, 1)::float                                 as "avgScore",
      COUNT(cr.id)::int                                     as "itemCount"
    FROM "ChecklistResponse" cr
    JOIN "ChecklistItem"      ci  ON cr."itemId"       = ci.id
    JOIN "ChecklistSection"   cs  ON ci."sectionId"    = cs.id
    JOIN "WorkOrderChecklist" woc ON cr."checklistId"  = woc.id
    JOIN "WorkOrder"          wo  ON woc."workOrderId" = wo.id
    WHERE
      cr.rating IS NOT NULL
      AND wo.status = 'INSPECTION_COMPLETED'
      AND wo."approvedAt" >= ${dateFilter.gte}
      AND wo."approvedAt" <= ${dateFilter.lte}
    GROUP BY cs.name, cs.order
    ORDER BY cs.order ASC
  `;

  const bandDistribution = await prisma.workOrder.groupBy({
    by: ['complianceBand'],
    where: {
      status: 'INSPECTION_COMPLETED',
      complianceBand: { not: null },
      approvedAt: dateFilter,
    },
    _count: { complianceBand: true },
  });

  return {
    reportType: 'SYSTEM_COMPLIANCE_SUMMARY',
    generatedAt: new Date().toISOString(),
    period: {
      year: reportYear,
      month: month || null,
      label: month
        ? `${new Date(reportYear, month - 1).toLocaleString('en', { month: 'long' })} ${reportYear}`
        : `Full Year ${reportYear}`,
    },
    systemKpis: {
      totalInspections,
      totalContractors,
      activeContractors,
      avgCompliance,
      complianceBand: scoreColor(avgCompliance),
      belowThresholdCount: contractorPerformance.filter((c) => c.belowThreshold).length,
    },
    statusBreakdown: statusBreakdown.map((s) => ({
      status: s.status,
      count: s._count.status,
    })),
    bandDistribution: bandDistribution.map((b) => ({
      band: b.complianceBand,
      count: b._count.complianceBand,
    })),
    monthlyTrend,
    contractorLeaderboard: contractorPerformance,
    categoryBreakdown,
  };
}

export async function generateContractorPerformanceReport(contractorIds: string[], years: number[], months: number[], regions: string[]) {
  const contractors =
    contractorIds.length || regions.length
      ? await prisma.contractor.findMany({
          where: {
            ...(contractorIds.length ? { id: { in: contractorIds } } : {}),
            ...(regions.length ? { regions: { hasSome: regions } } : {}),
          } as any,
          select: { id: true, companyName: true, contractorId: true, crNumber: true, regions: true } as any,
        })
      : [];

  const statuses: WorkOrderStatus[] = ['SUBMITTED', 'INSPECTION_COMPLETED'];
  const contractorFilter =
    contractorIds.length > 0 && regions.length > 0
      ? {
          contractor: {
            id: { in: contractorIds },
            regions: { hasSome: regions },
          },
        }
      : contractorIds.length > 0
        ? { contractorId: { in: contractorIds } }
        : regions.length > 0
          ? {
              contractor: {
                regions: { hasSome: regions },
              },
            }
          : {};
  const where = {
    ...contractorFilter,
    ...buildDateFilter(years, months),
    status: { in: statuses },
  } as any;

  const workOrders = (await prisma.workOrder.findMany({
    where,
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      priority: true,
      submittedAt: true,
      approvedAt: true,
      overallScore: true,
      complianceBand: true,
      contractorId: true,
      site: {
        select: {
          name: true,
          location: true,
          region: true,
        },
      },
      contractor: {
        select: {
          id: true,
          contractorId: true,
          companyName: true,
          crNumber: true,
        },
      },
      inspector: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
  })) as unknown as ContractorPerformanceWorkOrder[];

  const contractorMap = new Map<string, {
    contractorId: string | null;
    companyName: string;
    crNumber: string;
    totalWorkOrders: number;
    submittedCount: number;
    completedCount: number;
    totalScore: number;
    scoredCount: number;
  }>();

  for (const workOrder of workOrders) {
    const key = workOrder.contractorId ?? 'unknown';
    const existing = contractorMap.get(key) ?? {
      contractorId: workOrder.contractorId,
      companyName: workOrder.contractor?.companyName ?? 'Unknown Contractor',
      crNumber: workOrder.contractor?.crNumber ?? '-',
      totalWorkOrders: 0,
      submittedCount: 0,
      completedCount: 0,
      totalScore: 0,
      scoredCount: 0,
    };

    existing.totalWorkOrders += 1;
    if (workOrder.status === 'SUBMITTED') existing.submittedCount += 1;
    if (workOrder.status === 'INSPECTION_COMPLETED') existing.completedCount += 1;
    if (typeof workOrder.overallScore === 'number') {
      existing.totalScore += workOrder.overallScore;
      existing.scoredCount += 1;
    }

    contractorMap.set(key, existing);
  }

  const summary = Array.from(contractorMap.values()).map((item) => ({
    contractorId: item.contractorId,
    companyName: item.companyName,
    crNumber: item.crNumber,
    totalWorkOrders: item.totalWorkOrders,
    submittedCount: item.submittedCount,
    completedCount: item.completedCount,
    avgScore: item.scoredCount ? Math.round((item.totalScore / item.scoredCount) * 10) / 10 : 0,
  }));

  return {
    contractors,
    data: {
      reportType: 'CONTRACTOR_PERFORMANCE',
      generatedAt: new Date().toISOString(),
      filters: { contractorIds, years, months, regions },
      summary,
      workOrders: workOrders.map((workOrder) => ({
        id: workOrder.id,
        reference: workOrder.reference,
        title: workOrder.title,
        status: workOrder.status,
        priority: workOrder.priority,
        submittedAt: workOrder.submittedAt?.toISOString() ?? null,
        approvedAt: workOrder.approvedAt?.toISOString() ?? null,
        overallScore: workOrder.overallScore,
        complianceBand: workOrder.complianceBand,
        site: workOrder.site
          ? {
              name: workOrder.site.name,
              location: workOrder.site.location,
              region: workOrder.site.region,
            }
          : null,
        contractor: workOrder.contractor
          ? {
              id: workOrder.contractor.id,
              contractorId: workOrder.contractor.contractorId,
              companyName: workOrder.contractor.companyName,
              crNumber: workOrder.contractor.crNumber,
            }
          : null,
        inspector: workOrder.inspector
          ? {
              id: workOrder.inspector.id,
              displayName: workOrder.inspector.displayName,
            }
          : null,
      })),
    },
  };
}

export async function generatePerformanceSummaryReport(contractorIds: string[], years: number[], months: number[], regions: string[]) {
  const contractors =
    contractorIds.length || regions.length
      ? await prisma.contractor.findMany({
          where: {
            ...(contractorIds.length ? { id: { in: contractorIds } } : {}),
            ...(regions.length ? { regions: { hasSome: regions } } : {}),
          } as any,
          select: { id: true, companyName: true, regions: true } as any,
        })
      : [];

  const contractorFilter =
    contractorIds.length > 0 && regions.length > 0
      ? {
          contractor: {
            id: { in: contractorIds },
            regions: { hasSome: regions },
          },
        }
      : contractorIds.length > 0
        ? { contractorId: { in: contractorIds } }
        : regions.length > 0
          ? {
              contractor: {
                regions: { hasSome: regions },
              },
            }
          : {};

  const summaryWhere = {
    ...contractorFilter,
    ...buildDateFilter(years, months),
  } as any;

  const contractorStats = await prisma.workOrder.groupBy({
    by: ['contractorId'],
    where: summaryWhere,
    _count: { id: true },
    _avg: { overallScore: true },
  });

  const contractorLookup = contractorStats
    .map((row) => row.contractorId)
    .filter((value): value is string => Boolean(value));

  const contractorMeta = contractorLookup.length
    ? await prisma.contractor.findMany({
        where: { id: { in: contractorLookup } },
        select: { id: true, companyName: true, contractorId: true, crNumber: true },
      })
    : [];
  const contractorMetaMap = new Map(contractorMeta.map((item) => [item.id, item]));

  return {
    contractors,
    data: {
      reportType: 'PERFORMANCE_SUMMARY',
      generatedAt: new Date().toISOString(),
      filters: { contractorIds, years, months, regions },
      contractors: contractorStats.map((row) => {
        const meta = row.contractorId ? contractorMetaMap.get(row.contractorId) : null;
        return {
          contractorId: row.contractorId,
          companyName: meta?.companyName ?? 'Unknown Contractor',
          contractorCode: meta?.contractorId ?? null,
          crNumber: meta?.crNumber ?? null,
          totalWorkOrders: row._count.id,
          avgScore: Math.round((((row._avg?.overallScore as number | null) || 0) * 10)) / 10,
        };
      }),
    },
  };
}
