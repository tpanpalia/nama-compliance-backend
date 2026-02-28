import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

const OVERDUE_THRESHOLD_DAYS = 3;

export function computeDisplayStatus(wo: { status: string; submittedAt: Date | null }): string {
  if (wo.status === 'PENDING') return 'Unassigned Work Orders';
  if (wo.status === 'ASSIGNED') return 'Work Yet to Begin';
  if (wo.status === 'IN_PROGRESS') return 'WIP at Site';
  if (wo.status === 'APPROVED') return 'Inspection Completed';
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
  site: { select: { name: true } },
  contractor: { select: { companyName: true, crNumber: true } },
  inspector: { select: { displayName: true } },
};

const DETAIL_INCLUDE = {
  site: { select: { name: true, location: true } },
  contractor: { select: { id: true, companyName: true, crNumber: true, email: true, phone: true } },
  inspector: { select: { id: true, displayName: true, email: true, isActive: true } },
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
    prisma.workOrder.count({ where: { status: 'APPROVED' } }),
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
  status?: string;
  year?: number;
  month?: number;
  searchContractor?: string;
  searchInspector?: string;
  page: number;
  limit: number;
}) {
  const { status, year, month, searchContractor, searchInspector, page, limit } = filters;

  let statusFilter: any = undefined;
  let overdueFilter: any = undefined;

  if (status === 'OVERDUE') {
    const cutoff = new Date(Date.now() - OVERDUE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    statusFilter = 'SUBMITTED';
    overdueFilter = { lt: cutoff };
  } else if (status && status !== '') {
    statusFilter = status;
  }

  const where: any = {
    ...(statusFilter && { status: statusFilter }),
    ...(overdueFilter && { submittedAt: overdueFilter }),
  };

  if (year || month) {
    const gte = new Date(year || 2020, (month || 1) - 1, 1);
    const lte = month
      ? new Date(year || 2030, month, 0, 23, 59, 59)
      : new Date((year || 2030) + 1, 0, 0, 23, 59, 59);
    where.createdAt = { gte, lte };
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

export async function getWorkOrderById(id: string) {
  const wo = await prisma.workOrder.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!wo) throw new AppError('Work order not found', 404);

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
          fileUrl: null,
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

async function logAction(workOrderId: string, action: string, details: string) {
  await prisma.auditLog
    .create({
      data: { workOrderId, action, newValue: { details } as any },
    })
    .catch(() => {});
}

export async function approveWorkOrder(workOrderId: string, approvedById: string) {
  const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) throw new AppError('Work order not found', 404);
  if (wo.status !== 'SUBMITTED') {
    throw new AppError('Can only approve submitted work orders', 400);
  }

  const updated = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedById,
      isLocked: true,
    },
    include: DETAIL_INCLUDE,
  });

  return { ...updated, displayStatus: computeDisplayStatus(updated) };
}
