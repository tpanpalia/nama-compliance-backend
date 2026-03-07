import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { toNumberArray, toStringArray } from '../utils/queryFilters';
import { AppError } from '../utils/AppError';

const OVERDUE_THRESHOLD_DAYS = 3;

export function computeDisplayStatus(wo: { status: string; submittedAt: Date | null }): string {
  if (wo.status === 'PENDING') return 'Unassigned Work Orders';
  if (wo.status === 'ASSIGNED') return 'Work Yet to Begin';
  if (wo.status === 'IN_PROGRESS') return 'WIP at Site';
  if (wo.status === 'INSPECTION_COMPLETED') return 'Inspection Completed';
  if (wo.status === 'SUBMITTED') {
    if (wo.submittedAt) {
      const daysSince = (Date.now() - wo.submittedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > OVERDUE_THRESHOLD_DAYS) return 'Overdue for Inspection';
    }
    return 'Submitted for Inspection';
  }
  return wo.status;
}

const LIST_INCLUDE = {
  site: { select: { id: true, name: true, location: true, region: true } },
  contractor: { select: { id: true, contractorId: true, companyName: true, crNumber: true } },
  inspector: { select: { displayName: true } },
};

const DETAIL_INCLUDE = {
  site: { select: { name: true, location: true } },
  contractor: {
    select: {
      id: true,
      companyName: true,
      crNumber: true,
      phone: true,
      identity: { select: { email: true } },
    },
  },
  inspector: {
    select: {
      id: true,
      displayName: true,
      isActive: true,
      identity: { select: { email: true } },
    },
  },
  createdBy: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
  checklist: {
    include: {
      responses: {
        include: {
          item: {
            include: {
              section: { select: { id: true, name: true, weight: true, order: true } },
            },
          },
        },
        orderBy: [
          { item: { section: { order: 'asc' as const } } },
          { item: { order: 'asc' as const } },
        ],
      },
    },
  },
  evidence: true,
};

export async function getWorkOrderStats() {
  const now = new Date();
  const overdueCutoff = new Date(now.getTime() - OVERDUE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  const [total, completed, wip, overdue] = await Promise.all([
    prisma.workOrder.count(),
    prisma.workOrder.count({ where: { status: 'INSPECTION_COMPLETED' } }),
    prisma.workOrder.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.workOrder.count({
      where: {
        status: 'SUBMITTED',
        submittedAt: { lt: overdueCutoff },
      },
    }),
  ]);

  return { total, completed, wip, overdue };
}

export async function listWorkOrders(filters: {
  status?: string | string[];
  year?: string | string[];
  month?: string | string[];
  search?: string;
  searchContractor?: string;
  searchInspector?: string;
  page: number;
  limit: number;
  role?: string;
  contractorDbId?: string;
}) {
  const { status, year, month, search, searchContractor, searchInspector, page, limit, role, contractorDbId } = filters;
  const statuses = toStringArray(status).map((value) => value.toUpperCase());
  const years = toNumberArray(year);
  const months = toNumberArray(month);

  const where: Prisma.WorkOrderWhereInput = {};

  if (role === 'CONTRACTOR') {
    if (!contractorDbId) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    where.contractorId = contractorDbId;
  }

  if (searchContractor) {
    where.contractor = {
      OR: [
        { companyName: { contains: searchContractor, mode: 'insensitive' } },
        { crNumber: { contains: searchContractor, mode: 'insensitive' } },
        { contractorId: { contains: searchContractor, mode: 'insensitive' } },
      ],
    };
  }

  if (searchInspector) {
    where.inspector = {
      displayName: { contains: searchInspector, mode: 'insensitive' },
    };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
      { site: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (statuses.length) {
    where.status = { in: statuses as any };
  }

  const dateClauses: Prisma.WorkOrderWhereInput[] = [];

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
      const ymWindows: Prisma.WorkOrderWhereInput[] = [];
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
    where.AND = [...((where.AND as Prisma.WorkOrderWhereInput[]) ?? []), ...dateClauses];
  }

  const [workOrders, total] = await prisma.$transaction([
    prisma.workOrder.findMany({
      where,
      include: LIST_INCLUDE,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.workOrder.count({ where }),
  ]);

  const stats = await getWorkOrderStats();

  return {
    data: workOrders.map((wo) => ({
      ...wo,
      displayStatus: computeDisplayStatus(wo),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    stats,
  };
}

export async function getWorkOrderById(
  id: string,
  context?: {
    role?: string;
    contractorDbId?: string;
  }
) {
  const where: Prisma.WorkOrderWhereInput = { id };

  if (context?.role === 'CONTRACTOR') {
    if (!context.contractorDbId) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    where.contractorId = context.contractorDbId;
  }

  const wo = await prisma.workOrder.findFirst({
    where,
    include: DETAIL_INCLUDE,
  });
  if (!wo) throw new AppError('Work order not found', 404);

  const locationFlaggedCount = await prisma.evidence.count({
    where: {
      workOrderId: id,
      isLocationFlagged: true,
      isConfirmed: true,
    },
  });

  const sectionMap: Record<
    string,
    {
      sectionId: string;
      sectionName: string;
      weight: number;
      order: number;
      items: Array<{
        itemId: string;
        itemText: string;
        itemOrder: number;
        isRequired: boolean;
        responseId?: string;
        rating?: string;
        comment?: string;
        evidence: Array<{
          id: string;
          type: string;
          source: string;
          fileUrl: string | null;
          lat?: number | null;
          lng?: number | null;
          capturedAt?: Date | null;
        }>;
      }>;
    }
  > = {};

  if (wo.checklist) {
    for (const response of wo.checklist.responses) {
      const section = response.item.section;
      if (!sectionMap[section.id]) {
        sectionMap[section.id] = {
          sectionId: section.id,
          sectionName: section.name,
          weight: section.weight,
          order: section.order,
          items: [],
        };
      }
      sectionMap[section.id].items.push({
        itemId: response.item.id,
        itemText: response.item.text,
        itemOrder: response.item.order,
        isRequired: response.item.isRequired,
        responseId: response.id,
        rating: response.rating || undefined,
        comment: response.comment || undefined,
        evidence: (wo.evidence || []).map((e) => ({
          id: e.id,
          type: e.type,
          source: e.source,
          fileUrl: (e as any).s3Url || null,
          lat: e.latitude,
          lng: e.longitude,
          capturedAt: e.capturedAt,
        })),
      });
    }
  }

  const sections = Object.values(sectionMap)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      ...s,
      items: s.items.sort((a, b) => a.itemOrder - b.itemOrder),
    }));

  return {
    ...wo,
    site: wo.site ? { name: wo.site.name, address: wo.site.location } : null,
    displayStatus: computeDisplayStatus(wo),
    locationFlaggedCount,
    sections,
  };
}

export const CreateWorkOrderSchema = z.object({
  siteId: z.string().uuid(),
  title: z.string().min(3).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  scheduledDate: z.string().datetime().optional(),
});

export async function createWorkOrder(data: z.infer<typeof CreateWorkOrderSchema>, createdById: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const todayCount = await prisma.workOrder.count({
    where: { createdAt: { gte: todayStart, lt: todayEnd } },
  });

  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(todayCount + 1).padStart(4, '0');
  const reference = `WO-${ymd}-${seq}`;

  return prisma.workOrder.create({
    data: {
      reference,
      title: data.title || reference,
      status: 'PENDING',
      priority: data.priority,
      siteId: data.siteId,
      createdById,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
    },
    include: LIST_INCLUDE,
  });
}

export const AssignContractorSchema = z.object({
  contractorId: z.string().uuid(),
});

export async function assignContractor(workOrderId: string, contractorId: string) {
  const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) throw new AppError('Work order not found', 404);
  if (wo.isLocked) throw new AppError('Work order is locked and cannot be modified', 400);

  const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
  if (!contractor) throw new AppError('Contractor not found', 404);
  if (!contractor.isActive) throw new AppError('Contractor is not active', 400);

  const updated = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      contractorId,
      status: 'ASSIGNED',
      startedAt: null,
    },
    include: DETAIL_INCLUDE,
  });

  await logAction(workOrderId, 'ASSIGN_CONTRACTOR', `Contractor assigned: ${contractor.companyName}`);
  return { ...updated, displayStatus: computeDisplayStatus(updated) };
}

export const AssignInspectorSchema = z.object({
  inspectorId: z.string().uuid(),
});

export async function assignInspector(workOrderId: string, inspectorId: string) {
  const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) throw new AppError('Work order not found', 404);
  if (wo.isLocked) throw new AppError('Work order is locked', 400);
  if (wo.status === 'PENDING') throw new AppError('Assign contractor first', 400);

  const inspector = await prisma.user.findUnique({ where: { id: inspectorId } });
  if (!inspector || inspector.role !== 'INSPECTOR') {
    throw new AppError('Inspector not found', 404);
  }

  const updated = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { inspectorId },
    include: DETAIL_INCLUDE,
  });

  await logAction(workOrderId, 'ASSIGN_INSPECTOR', `Inspector assigned: ${inspector.displayName}`);
  return { ...updated, displayStatus: computeDisplayStatus(updated) };
}

export async function submitWorkOrder(workOrderId: string, contractorId: string, actorUserId?: string) {
  const workOrder = await prisma.workOrder.findFirst({
    where: {
      id: workOrderId,
      contractorId,
    },
    include: {
      site: true,
    },
  });

  if (!workOrder) {
    throw new AppError('Work order not found or not accessible', 404, 'NOT_FOUND');
  }

  if (workOrder.status !== 'ASSIGNED' && workOrder.status !== 'IN_PROGRESS') {
    throw new AppError(
      `Cannot submit a work order with status ${workOrder.status}. Only ASSIGNED or IN_PROGRESS work orders can be submitted.`,
      400,
      'INVALID_WORK_ORDER_STATUS'
    );
  }

  const evidenceCount = await prisma.evidence.count({
    where: {
      workOrderId,
      isConfirmed: true,
    },
  });

  if (evidenceCount === 0) {
    throw new AppError(
      'Please upload at least one photo or video as evidence before submitting.',
      400,
      'EVIDENCE_REQUIRED'
    );
  }

  const updated = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
    include: DETAIL_INCLUDE,
  });

  await logAction(
    workOrderId,
    'SUBMITTED',
    `Work order submitted for inspection. Evidence count: ${evidenceCount}`,
    actorUserId,
    {
      previousStatus: workOrder.status,
      evidenceCount,
    }
  );

  return { ...updated, displayStatus: computeDisplayStatus(updated) };
}

async function logAction(
  workOrderId: string,
  action: string,
  details: string,
  userId?: string,
  extra?: Record<string, unknown>
) {
  await prisma.auditLog
    .create({
      data: {
        workOrderId,
        userId: userId || undefined,
        action,
        newValue: {
          details,
          ...(extra || {}),
        } as any,
      },
    })
    .catch(() => {});
}

export async function completeInspection(workOrderId: string, approvedById: string) {
  const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) throw new AppError('Work order not found', 404);
  if (wo.status !== 'SUBMITTED') {
    throw new AppError('Can only complete submitted work orders', 400);
  }

  const updated = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: 'INSPECTION_COMPLETED',
      approvedAt: new Date(),
      approvedById,
      isLocked: true,
    },
    include: DETAIL_INCLUDE,
  });

  await logAction(workOrderId, 'INSPECTION_COMPLETED', `Inspection completed. Score: ${updated.overallScore ?? 'N/A'}`);
  return { ...updated, displayStatus: computeDisplayStatus(updated) };
}
