import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { toNumberArray, toStringArray } from '../utils/queryFilters';
import { ACTIVE_WO_STATUSES, activeProjectsFilter } from '../utils/queryHelpers';
import { AppError } from '../utils/AppError';

export const UpdateContractorSchema = z.object({
  companyName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  address: z.string().optional(),
  regions: z.array(z.string()).optional(),
});

export const CreateContractorSchema = z.object({
  contractorId: z.string().min(3),
  companyName: z.string().min(2),
  tradeLicense: z.string().min(2),
  crNumber: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().optional(),
  regions: z.array(z.string()).optional(),
});

export const UpdateContractorStatusSchema = z.object({
  isActive: z.boolean(),
});

async function computeComplianceTrend(contractorId: string): Promise<number> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [current, previous] = await Promise.all([
    prisma.workOrder.aggregate({
      where: {
        contractorId,
        status: 'INSPECTION_COMPLETED',
        overallScore: { not: null },
        approvedAt: { gte: thisMonthStart },
      },
      _avg: { overallScore: true },
    }),
    prisma.workOrder.aggregate({
      where: {
        contractorId,
        status: 'INSPECTION_COMPLETED',
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
  totalWorkOrders?: number;
  [key: string]: unknown;
}) {
  const [activeProjects, totalWorkOrders, avgResult, trend] = await Promise.all([
    prisma.workOrder.count({
      where: {
        contractorId: contractor.id,
        status: { in: [...ACTIVE_WO_STATUSES] },
      },
    }),
    prisma.workOrder.count({
      where: {
        contractorId: contractor.id,
      },
    }),
    prisma.workOrder.aggregate({
      where: {
        contractorId: contractor.id,
        status: 'INSPECTION_COMPLETED',
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

  const complianceStatus =
    avgCompliance >= 80 ? 'Compliant' : avgCompliance >= 70 ? 'Needs Attention' : avgCompliance > 0 ? 'Non-Compliant' : 'No Data';

  return {
    ...contractor,
    activeProjects,
    totalWorkOrders,
    avgCompliance,
    complianceTrend: trend,
    displayStatus,
    complianceStatus,
  };
}

export async function listContractors(filters: {
  search?: string;
  status?: string | string[];
  isActive?: boolean;
  year?: string | string[];
  month?: string | string[];
  page: number;
  limit: number;
  sortBy?: string;
  sortDir?: string;
}) {
  const { search, status, isActive, year, month, page, limit, sortBy, sortDir } = filters;
  const normalizedStatuses = toStringArray(status).map((value) => value.toLowerCase());
  const years = toNumberArray(year);
  const months = toNumberArray(month);

  const hasActive = normalizedStatuses.includes('active');
  const hasInactive = normalizedStatuses.includes('inactive');
  const statusFilter =
    hasActive && hasInactive
      ? undefined
      : hasActive
        ? true
        : hasInactive
          ? false
          : isActive;

  const where: Prisma.ContractorWhereInput = {
    ...(statusFilter !== undefined && { isActive: statusFilter }),
    ...(search && {
      OR: [
        { companyName: { contains: search, mode: 'insensitive' } },
        { identity: { email: { contains: search, mode: 'insensitive' } } },
        { contractorId: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const dateClauses: Prisma.ContractorWhereInput[] = [];

  if (years.length) {
    dateClauses.push({
      OR: years.map((y) => ({
        createdAt: {
          gte: new Date(Date.UTC(y, 0, 1, 0, 0, 0)),
          lt: new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0)),
        },
      })),
    });
  }

  if (months.length) {
    if (years.length) {
      const ymWindows: Prisma.ContractorWhereInput[] = [];
      for (const y of years) {
        for (const m of months) {
          if (m >= 1 && m <= 12) {
            ymWindows.push({
              createdAt: {
                gte: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)),
                lt: new Date(Date.UTC(y, m, 1, 0, 0, 0)),
              },
            });
          }
        }
      }
      dateClauses.length = 0;
      if (ymWindows.length) dateClauses.push({ OR: ymWindows });
    } else {
      // Month-only filtering without year is intentionally skipped.
    }
  }

  if (dateClauses.length) {
    where.AND = [...((where.AND as Prisma.ContractorWhereInput[]) ?? []), ...dateClauses];
  }

  const [contractors, total] = await prisma.$transaction([
    prisma.contractor.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { companyName: 'asc' },
      select: {
        id: true,
        contractorId: true,
        companyName: true,
        identity: { select: { email: true } },
        phone: true,
        address: true,
        regions: true,
        contactName: true,
        crNumber: true,
        isActive: true,
        createdAt: true,
      } as any,
    }),
    prisma.contractor.count({ where }),
  ]);

  const enriched = await Promise.all(
    (contractors as unknown as Array<{ id: string; isActive: boolean; companyName?: string; totalWorkOrders?: number }>).map(
      enrichContractor
    )
  );

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
      where: activeProjectsFilter as Prisma.WorkOrderWhereInput,
    }),
  ]);

  const allScores = await prisma.workOrder.aggregate({
    where: { status: 'INSPECTION_COMPLETED', overallScore: { not: null } },
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
      identity: { select: { email: true } },
      phone: true,
      address: true,
      regions: true,
      contactName: true,
      crNumber: true,
      isActive: true,
      createdAt: true,
    } as any,
  });

  if (!contractor) throw new AppError('Contractor not found', 404);
  return contractor;
}

export async function getContractorPerformance(id: string) {
  await getContractorById(id);

  const [totalWorkOrders, completedWorkOrders, avgResult, workOrders] = await Promise.all([
    prisma.workOrder.count({ where: { contractorId: id } }),
    prisma.workOrder.count({ where: { contractorId: id, status: 'INSPECTION_COMPLETED' } }),
    prisma.workOrder.aggregate({
      where: { contractorId: id, status: 'INSPECTION_COMPLETED', overallScore: { not: null } },
      _avg: { overallScore: true },
    }),
    prisma.workOrder.findMany({
      where: { contractorId: id, status: 'INSPECTION_COMPLETED' },
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
      TO_CHAR(months.month_start, 'Mon') as month,
      COALESCE(ROUND(AVG(wo."overallScore")::numeric, 1)::float, 0) as "avgScore"
    FROM generate_series(
      DATE_TRUNC('year', NOW()),
      DATE_TRUNC('year', NOW()) + INTERVAL '11 months',
      INTERVAL '1 month'
    ) AS months(month_start)
    LEFT JOIN "WorkOrder" wo
      ON DATE_TRUNC('month', wo."approvedAt") = months.month_start
      AND wo."contractorId" = ${id}
      AND wo.status = 'INSPECTION_COMPLETED'
      AND wo."overallScore" IS NOT NULL
    GROUP BY months.month_start
    ORDER BY months.month_start ASC
  `;

  const complianceByCategory = await prisma.$queryRaw<Array<{ name: string; avgScore: number }>>`
    SELECT
      cs.name as name,
      ROUND(
        AVG(
          CASE cr.rating
            WHEN 'COMPLIANT' THEN 100
            WHEN 'PARTIAL' THEN 50
            WHEN 'NON_COMPLIANT' THEN 0
          END
        )::numeric,
        1
      )::float as "avgScore"
    FROM "WorkOrder" wo
    JOIN "WorkOrderChecklist" woc ON woc."workOrderId" = wo.id
    JOIN "ChecklistResponse" cr ON cr."checklistId" = woc.id
    JOIN "ChecklistItem" ci ON ci.id = cr."itemId"
    JOIN "ChecklistSection" cs ON cs.id = ci."sectionId"
    WHERE
      wo."contractorId" = ${id}
      AND wo.status = 'INSPECTION_COMPLETED'
      AND cr.rating IS NOT NULL
    GROUP BY cs.id, cs.name, cs."order"
    ORDER BY cs."order" ASC, cs.name ASC
  `;

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
    const existing = await prisma.identity.findFirst({
      where: { email: data.email, contractorId: { not: id } },
    });
    if (existing) throw new AppError('Email already in use', 409);
  }

  return prisma.contractor.update({
    where: { id },
    data: {
      companyName: data.companyName,
      phone: data.phone,
      address: data.address,
      ...(data.regions && { regions: data.regions }),
      ...(data.email && {
        identity: {
          update: {
            email: data.email,
          },
        },
      }),
    } as any,
    select: {
      id: true,
      contractorId: true,
      companyName: true,
      identity: { select: { email: true } },
      phone: true,
      address: true,
      regions: true,
      contactName: true,
      crNumber: true,
      isActive: true,
      createdAt: true,
    } as any,
  });
}

export async function createContractor(data: z.infer<typeof CreateContractorSchema>) {
  const existingIdentity = await prisma.identity.findUnique({
    where: { email: data.email },
  });
  if (existingIdentity) throw new AppError('Email already in use', 409);

  const existingContractor = await prisma.contractor.findFirst({
    where: {
      OR: [{ contractorId: data.contractorId }, { crNumber: data.crNumber }],
    },
  });
  if (existingContractor) throw new AppError('Contractor already exists', 409);

  const passwordHash = await bcrypt.hash('mobile123', 10);

  return prisma.contractor.create({
    data: {
      contractorId: data.contractorId,
      companyName: data.companyName,
      tradeLicense: data.tradeLicense,
      crNumber: data.crNumber,
      contactName: data.contactName,
      phone: data.phone,
      address: data.address,
      regions: data.regions ?? [],
      isActive: true,
      identity: {
        create: {
          email: data.email,
          password: passwordHash,
          role: 'CONTRACTOR',
          isActive: true,
        },
      },
    } as any,
    select: {
      id: true,
      contractorId: true,
      companyName: true,
      identity: { select: { email: true } },
      phone: true,
      address: true,
      regions: true,
      contactName: true,
      crNumber: true,
      isActive: true,
      createdAt: true,
    } as any,
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
