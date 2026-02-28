import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { z } from 'zod';
import { generateWorkOrderReference } from '../types';
import { calculateComplianceScore } from './scoring.service';
import { logAction } from './audit.service';

export const CreateWorkOrderSchema = z.object({
  title: z.string().min(5),
  description: z.string().optional(),
  siteId: z.string().uuid(),
  contractorId: z.string().uuid().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  scheduledDate: z.string().datetime().optional(),
});

export const AssignWorkOrderSchema = z.object({
  inspectorId: z.string().uuid().optional(),
  contractorId: z.string().uuid().optional(),
});

export const RejectWorkOrderSchema = z.object({
  reason: z.string().min(10),
});

const WO_INCLUDE = {
  site: { select: { id: true, name: true, region: true } },
  inspector: { select: { id: true, displayName: true, email: true } },
  contractor: { select: { id: true, contractorId: true, companyName: true } },
  createdBy: { select: { id: true, displayName: true } },
  _count: { select: { evidence: true } },
};

async function assertNotLocked(id: string) {
  const wo = await prisma.workOrder.findUnique({ where: { id }, select: { isLocked: true } });
  if (!wo) throw new AppError('Work order not found', 404);
  if (wo.isLocked) throw new AppError('Work order is locked and cannot be modified', 423);
  return wo;
}

export async function listWorkOrders(filters: {
  role: string;
  userId: string;
  status?: string;
  inspectorId?: string;
  contractorId?: string;
  siteId?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}) {
  const { role, userId, page, limit } = filters;
  const where: any = {};

  if (role === 'INSPECTOR') {
    where.OR = [{ inspectorId: userId }, { status: 'PENDING', inspectorId: null }];
  } else if (role === 'CONTRACTOR') {
    where.contractorId = userId;
  }

  if (filters.status) where.status = filters.status;
  if (filters.inspectorId) where.inspectorId = filters.inspectorId;
  if (filters.contractorId) where.contractorId = filters.contractorId;
  if (filters.siteId) where.siteId = filters.siteId;
  if (filters.priority) where.priority = filters.priority;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
      ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
    };
  }

  const [data, total] = await prisma.$transaction([
    prisma.workOrder.findMany({
      where,
      include: WO_INCLUDE,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.workOrder.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getWorkOrderById(id: string, role?: string, userId?: string) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      ...WO_INCLUDE,
      approvedBy: { select: { id: true, displayName: true } },
      checklist: { select: { isSubmitted: true, lastSavedAt: true, submittedAt: true } },
    },
  });
  if (!workOrder) throw new AppError('Work order not found', 404);
  if (role === 'CONTRACTOR' && workOrder.contractorId !== userId) {
    throw new AppError('Access denied', 403);
  }
  return workOrder;
}

export async function createWorkOrder(data: z.infer<typeof CreateWorkOrderSchema>, createdById: string) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const count = await prisma.workOrder.count({ where: { createdAt: { gte: yearStart } } });
  const reference = generateWorkOrderReference(count + 1);

  const workOrder = await prisma.workOrder.create({
    data: {
      reference,
      title: data.title,
      description: data.description,
      siteId: data.siteId,
      contractorId: data.contractorId,
      priority: data.priority,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      createdById,
      status: data.contractorId ? 'ASSIGNED' : 'PENDING',
    },
    include: WO_INCLUDE,
  });

  logAction({
    workOrderId: workOrder.id,
    userId: createdById,
    action: 'WORK_ORDER_CREATED',
    newValue: { reference, status: workOrder.status },
  });

  return workOrder;
}

export async function assignWorkOrder(id: string, data: z.infer<typeof AssignWorkOrderSchema>, assignedById: string) {
  await assertNotLocked(id);
  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      ...(data.inspectorId && { inspectorId: data.inspectorId }),
      ...(data.contractorId && { contractorId: data.contractorId }),
      status: 'ASSIGNED',
    },
    include: WO_INCLUDE,
  });
  logAction({ workOrderId: id, userId: assignedById, action: 'WORK_ORDER_ASSIGNED' });
  return updated;
}

export async function selfAssignWorkOrder(id: string, inspectorId: string) {
  const workOrder = await prisma.workOrder.findUnique({ where: { id } });
  if (!workOrder) throw new AppError('Work order not found', 404);
  if (workOrder.status !== 'PENDING' || workOrder.inspectorId !== null) {
    throw new AppError('Work order is not available for self-assignment', 400);
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: { inspectorId, status: 'ASSIGNED' },
    include: WO_INCLUDE,
  });
  logAction({ workOrderId: id, userId: inspectorId, action: 'WORK_ORDER_SELF_ASSIGNED' });
  return updated;
}

export async function startWorkOrder(id: string, inspectorId: string) {
  await assertNotLocked(id);
  const workOrder = await prisma.workOrder.findUnique({ where: { id } });
  if (!workOrder) throw new AppError('Work order not found', 404);
  if (workOrder.status !== 'ASSIGNED') {
    throw new AppError('Work order must be ASSIGNED before starting', 400);
  }
  if (workOrder.inspectorId !== inspectorId) {
    throw new AppError('You are not assigned to this work order', 403);
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
    include: WO_INCLUDE,
  });
  logAction({ workOrderId: id, userId: inspectorId, action: 'WORK_ORDER_STARTED' });
  return updated;
}

export async function submitWorkOrder(id: string, inspectorId: string) {
  await assertNotLocked(id);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      checklist: {
        include: {
          responses: {
            include: {
              item: {
                include: {
                  section: {
                    select: {
                      name: true,
                      weight: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!workOrder) throw new AppError('Work order not found', 404);
  if (!workOrder.checklist) throw new AppError('No checklist found for this work order', 400);

  const responses = workOrder.checklist.responses.map((r) => ({
    rating: r.rating as any,
    isRequired: r.item.isRequired,
    sectionName: r.item.section.name,
    sectionWeight: r.item.section.weight,
  }));

  let scoreResult;
  try {
    scoreResult = calculateComplianceScore({ responses });
  } catch (err: any) {
    throw new AppError(err.message, 400);
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      overallScore: scoreResult.overallScore,
      complianceBand: scoreResult.complianceBand as any,
    },
    include: WO_INCLUDE,
  });

  logAction({
    workOrderId: id,
    userId: inspectorId,
    action: 'WORK_ORDER_SUBMITTED',
    newValue: { overallScore: scoreResult.overallScore, complianceBand: scoreResult.complianceBand },
  });

  return { ...updated, categoryScores: scoreResult.categoryScores };
}

export async function approveWorkOrder(id: string, approvedById: string) {
  await assertNotLocked(id);
  const workOrder = await prisma.workOrder.findUnique({ where: { id } });
  if (!workOrder) throw new AppError('Work order not found', 404);
  if (workOrder.status !== 'SUBMITTED') {
    throw new AppError('Only SUBMITTED work orders can be approved', 400);
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedById, isLocked: true },
    include: WO_INCLUDE,
  });
  logAction({ workOrderId: id, userId: approvedById, action: 'WORK_ORDER_APPROVED' });
  return updated;
}

export async function rejectWorkOrder(id: string, reason: string, rejectedById: string) {
  await assertNotLocked(id);
  const workOrder = await prisma.workOrder.findUnique({ where: { id } });
  if (!workOrder) throw new AppError('Work order not found', 404);
  if (workOrder.status !== 'SUBMITTED') {
    throw new AppError('Only SUBMITTED work orders can be rejected', 400);
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: reason },
    include: WO_INCLUDE,
  });
  logAction({ workOrderId: id, userId: rejectedById, action: 'WORK_ORDER_REJECTED', newValue: { reason } });
  return updated;
}

export async function reopenWorkOrder(id: string, reopenedById: string) {
  await assertNotLocked(id);
  const workOrder = await prisma.workOrder.findUnique({ where: { id } });
  if (!workOrder) throw new AppError('Work order not found', 404);
  if (workOrder.status !== 'REJECTED') {
    throw new AppError('Only REJECTED work orders can be reopened', 400);
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: { status: 'IN_PROGRESS', rejectionReason: null },
    include: WO_INCLUDE,
  });
  logAction({ workOrderId: id, userId: reopenedById, action: 'WORK_ORDER_REOPENED' });
  return updated;
}
