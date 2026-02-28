import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const UpdateContractorSchema = z.object({
  companyName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  address: z.string().optional(),
});

export const UpdateContractorStatusSchema = z.object({
  isActive: z.boolean(),
});

void bcrypt;

async function computeComplianceTrend(contractorId: string): Promise<number> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [current, previous] = await Promise.all([
    prisma.workOrder.aggregate({
      where: {
        contractorId,
        status: 'APPROVED',
        overallScore: { not: null },
        approvedAt: { gte: thisMonthStart },
      },
      _avg: { overallScore: true },
    }),
    prisma.workOrder.aggregate({
      where: {
        contractorId,
        status: 'APPROVED',
        overallScore: { not: null },
        approvedAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      _avg: { overallScore: true },
    }),
  ]);

  const curr = current._avg.overallScore || 0;
  const prev = previous._avg.overallScore || 0;
  return Math.round((curr - prev) * 10) / 10;
}

export async function enrichContractor(contractor: {
  id: string;
  isActive: boolean;
  companyName?: string;
  [key: string]: unknown;
}) {
  const [activeProjects, avgResult, trend] = await Promise.all([
    prisma.workOrder.count({
      where: {
        contractorId: contractor.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
    }),
    prisma.workOrder.aggregate({
      where: {
        contractorId: contractor.id,
        status: 'APPROVED',
        overallScore: { not: null },
      },
      _avg: { overallScore: true },
    }),
    computeComplianceTrend(contractor.id),
  ]);

  const avgCompliance = Math.round((avgResult._avg.overallScore || 0) * 10) / 10;

  const displayStatus = !contractor.isActive
    ? 'Inactive'
    : avgCompliance > 0 && avgCompliance < 70
      ? 'Needs Attention'
      : 'Active';

  return {
    ...contractor,
    activeProjects,
    avgCompliance,
    complianceTrend: trend,
    displayStatus,
  };
}

export async function listContractors(filters: {
  search?: string;
  isActive?: boolean;
  page: number;
  limit: number;
  sortBy?: string;
  sortDir?: string;
}) {
  const { search, isActive, page, limit, sortBy, sortDir } = filters;

  const where: any = {
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { contractorId: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const contractors = await prisma.contractor.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { companyName: 'asc' },
    select: {
      id: true,
      contractorId: true,
      companyName: true,
      email: true,
      phone: true,
      address: true,
      contactName: true,
      crNumber: true,
      isActive: true,
      createdAt: true,
    },
  });

  const total = await prisma.contractor.count({ where });
  const enriched = await Promise.all(contractors.map(enrichContractor));

  if (sortBy) {
    const dir = sortDir === 'asc' ? 1 : -1;
    enriched.sort((a, b) => {
      if (sortBy === 'compliance') return ((a.avgCompliance as number) - (b.avgCompliance as number)) * dir;
      if (sortBy === 'projects') return ((a.activeProjects as number) - (b.activeProjects as number)) * dir;
      return String(a.companyName).localeCompare(String(b.companyName)) * dir;
    });
  }

  const [totalAll, activeProjectsTotal] = await Promise.all([
    prisma.contractor.count(),
    prisma.workOrder.count({
      where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
    }),
  ]);

  const allScores = await prisma.workOrder.aggregate({
    where: { status: 'APPROVED', overallScore: { not: null } },
    _avg: { overallScore: true },
  });

  const avgCompliance = Math.round((allScores._avg.overallScore || 0) * 10) / 10;
  const belowThreshold = enriched.filter((c) => c.isActive && c.avgCompliance > 0 && c.avgCompliance < 70).length;

  return {
    data: enriched,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    stats: {
      totalContractors: totalAll,
      activeProjectsTotal,
      avgCompliance,
      belowThreshold,
    },
  };
}

export async function getContractorById(id: string) {
  const contractor = await prisma.contractor.findUnique({
    where: { id },
    select: {
      id: true,
      contractorId: true,
      companyName: true,
      email: true,
      phone: true,
      address: true,
      contactName: true,
      crNumber: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!contractor) throw new AppError('Contractor not found', 404);
  return contractor;
}

export async function getContractorPerformance(id: string) {
  await getContractorById(id);

  const [totalWorkOrders, completedWorkOrders, avgResult, workOrders] = await Promise.all([
    prisma.workOrder.count({ where: { contractorId: id } }),
    prisma.workOrder.count({ where: { contractorId: id, status: 'APPROVED' } }),
    prisma.workOrder.aggregate({
      where: { contractorId: id, status: 'APPROVED', overallScore: { not: null } },
      _avg: { overallScore: true },
    }),
    prisma.workOrder.findMany({
      where: { contractorId: id, status: 'APPROVED' },
      include: {
        site: { select: { name: true } },
        inspector: { select: { displayName: true } },
        checklist: {
          include: {
            responses: {
              include: {
                item: {
                  include: {
                    section: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { approvedAt: 'desc' },
    }),
  ]);

  const overallCompliance = Math.round((avgResult._avg.overallScore || 0) * 10) / 10;

  const bandCounts = { EXCELLENT: 0, GOOD: 0, FAIR: 0, POOR: 0 };
  workOrders.forEach((wo) => {
    if (wo.complianceBand) bandCounts[wo.complianceBand as keyof typeof bandCounts]++;
  });

  const total = workOrders.length;
  const complianceDistribution = {
    compliant: {
      count: bandCounts.EXCELLENT + bandCounts.GOOD,
      pct: total ? Math.round(((bandCounts.EXCELLENT + bandCounts.GOOD) / total) * 100) : 0,
    },
    partial: { count: bandCounts.FAIR, pct: total ? Math.round((bandCounts.FAIR / total) * 100) : 0 },
    nonCompliant: { count: bandCounts.POOR, pct: total ? Math.round((bandCounts.POOR / total) * 100) : 0 },
  };

  const monthlyTrend = await prisma.$queryRaw<Array<{ month: string; avgScore: number }>>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', "approvedAt"), 'Mon') as month,
      ROUND(AVG("overallScore")::numeric, 1)::float as "avgScore"
    FROM "WorkOrder"
    WHERE
      "contractorId" = ${id}
      AND status = 'APPROVED'
      AND "overallScore" IS NOT NULL
      AND "approvedAt" >= NOW() - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', "approvedAt")
    ORDER BY DATE_TRUNC('month', "approvedAt") ASC
  `;

  const POINTS: Record<string, number> = {
    COMPLIANT: 100,
    PARTIAL: 67,
    NON_COMPLIANT: 33,
  };
  const categoryTotals: Record<string, { sum: number; count: number }> = {};

  workOrders.forEach((wo) => {
    wo.checklist?.responses.forEach((r) => {
      const section = r.item.section.name;
      if (!categoryTotals[section]) categoryTotals[section] = { sum: 0, count: 0 };
      if (r.rating) {
        categoryTotals[section].sum += POINTS[r.rating] || 0;
        categoryTotals[section].count += 1;
      }
    });
  });

  const complianceByCategory = Object.entries(categoryTotals).map(([name, val]) => ({
    name,
    avgScore: val.count ? Math.round((val.sum / val.count) * 10) / 10 : 0,
  }));

  const inspectionHistory = workOrders.slice(0, 20).map((wo) => ({
    id: wo.id,
    reference: wo.reference,
    siteName: wo.site?.name || '-',
    inspectionDate: wo.approvedAt,
    inspectorName: wo.inspector?.displayName || '-',
    finalScore: wo.overallScore,
    complianceBand: wo.complianceBand,
    status: 'Completed',
  }));

  return {
    overallCompliance,
    totalWorkOrders,
    completedInspections: completedWorkOrders,
    nonCompliantCount: bandCounts.POOR,
    complianceDistribution,
    monthlyTrend,
    complianceByCategory,
    inspectionHistory,
  };
}

export async function updateContractor(id: string, data: z.infer<typeof UpdateContractorSchema>) {
  await getContractorById(id);

  if (data.email) {
    const existing = await prisma.contractor.findFirst({
      where: { email: data.email, id: { not: id } },
    });
    if (existing) throw new AppError('Email already in use', 409);
  }

  return prisma.contractor.update({
    where: { id },
    data,
    select: {
      id: true,
      contractorId: true,
      companyName: true,
      email: true,
      phone: true,
      address: true,
      contactName: true,
      crNumber: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function updateContractorStatus(id: string, isActive: boolean) {
  await getContractorById(id);
  return prisma.contractor.update({
    where: { id },
    data: { isActive },
    select: { id: true, contractorId: true, isActive: true },
  });
}

export async function deleteContractor(id: string) {
  await getContractorById(id);

  const woCount = await prisma.workOrder.count({ where: { contractorId: id } });
  if (woCount > 0) {
    throw new AppError('Cannot delete contractor with existing work orders. Deactivate instead.', 400);
  }

  await prisma.contractor.delete({ where: { id } });
  return { deleted: true };
}
