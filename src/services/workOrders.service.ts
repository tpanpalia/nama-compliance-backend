import { ComplianceBand, Prisma, WorkOrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { generateWorkOrderReference } from '../types';
import { calculateComplianceScore } from './scoring.service';
import { logAction } from './audit.service';

export const listWorkOrders = async (args: {
  userRole: string;
  userId?: string;
  contractorId?: string;
  filters: Prisma.WorkOrderWhereInput;
  page: number;
  limit: number;
}) => {
  const where: Prisma.WorkOrderWhereInput = { ...args.filters };

  if (args.userRole === 'INSPECTOR' && args.userId) {
    where.OR = [{ inspectorId: args.userId }, { status: WorkOrderStatus.PENDING, inspectorId: null }];
  }
  if (args.userRole === 'CONTRACTOR' && args.contractorId) {
    where.contractorId = args.contractorId;
  }

  const [total, items] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      include: { site: true, inspector: true, contractor: true },
      skip: (args.page - 1) * args.limit,
      take: args.limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { total, items };
};

export const createWorkOrder = async (
  data: {
    title: string;
    description?: string;
    siteId: string;
    contractorId?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    scheduledDate?: string;
  },
  createdById: string
) => {
  const count = await prisma.workOrder.count();
  const reference = generateWorkOrderReference(count + 1);

  return prisma.workOrder.create({
    data: {
      reference,
      title: data.title,
      description: data.description,
      siteId: data.siteId,
      contractorId: data.contractorId,
      priority: data.priority,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      createdById,
      status: data.contractorId ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.PENDING,
    },
  });
};

const assertNotLocked = (isLocked: boolean): void => {
  if (isLocked) {
    throw new Error('Work order is locked and cannot be modified');
  }
};

export const assignWorkOrder = async (
  id: string,
  inspectorId: string,
  contractorId: string,
  userId?: string,
  ipAddress?: string
) => {
  const current = await prisma.workOrder.findUniqueOrThrow({ where: { id } });
  assertNotLocked(current.isLocked);

  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      inspectorId,
      contractorId,
      status: WorkOrderStatus.ASSIGNED,
    },
  });

  logAction({ workOrderId: id, userId, action: 'WORK_ORDER_ASSIGNED', oldValue: current, newValue: updated, ipAddress });
  return updated;
};

export const selfAssignWorkOrder = async (id: string, inspectorId: string, userId?: string, ipAddress?: string) => {
  const current = await prisma.workOrder.findUniqueOrThrow({ where: { id } });
  assertNotLocked(current.isLocked);
  if (current.status !== WorkOrderStatus.PENDING || current.inspectorId) {
    throw new Error('Work order is not available for self assignment');
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: { inspectorId, status: WorkOrderStatus.ASSIGNED },
  });

  logAction({ workOrderId: id, userId, action: 'WORK_ORDER_SELF_ASSIGNED', oldValue: current, newValue: updated, ipAddress });
  return updated;
};

export const startWorkOrder = async (id: string, userId?: string, ipAddress?: string) => {
  const current = await prisma.workOrder.findUniqueOrThrow({ where: { id } });
  assertNotLocked(current.isLocked);
  if (current.status !== WorkOrderStatus.ASSIGNED) {
    throw new Error('Only ASSIGNED work orders can be started');
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: { status: WorkOrderStatus.IN_PROGRESS, startedAt: new Date() },
  });

  logAction({ workOrderId: id, userId, action: 'WORK_ORDER_STARTED', oldValue: current, newValue: updated, ipAddress });
  return updated;
};

export const submitWorkOrder = async (id: string, userId?: string, ipAddress?: string) => {
  const workOrder = await prisma.workOrder.findUniqueOrThrow({
    where: { id },
    include: {
      checklist: {
        include: {
          responses: {
            include: {
              item: { include: { section: true } },
            },
          },
        },
      },
    },
  });

  assertNotLocked(workOrder.isLocked);

  const checklist = workOrder.checklist;
  if (!checklist) {
    throw new Error('Checklist not found for work order');
  }

  const scoringInput = checklist.responses.map((response) => ({
    sectionName: response.item.section.name,
    sectionWeight: response.item.section.weight,
    isRequired: response.item.isRequired,
    rating: response.rating,
  }));

  const { overallScore, complianceBand } = calculateComplianceScore(scoringInput);

  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      status: WorkOrderStatus.SUBMITTED,
      submittedAt: new Date(),
      isLocked: false,
      overallScore,
      complianceBand: complianceBand as ComplianceBand,
    },
  });

  logAction({ workOrderId: id, userId, action: 'WORK_ORDER_SUBMITTED', oldValue: workOrder, newValue: updated, ipAddress });
  return updated;
};

export const approveWorkOrder = async (id: string, approverId: string, userId?: string, ipAddress?: string) => {
  const current = await prisma.workOrder.findUniqueOrThrow({ where: { id } });
  assertNotLocked(current.isLocked);

  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      status: WorkOrderStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: approverId,
      isLocked: true,
    },
  });

  logAction({ workOrderId: id, userId, action: 'WORK_ORDER_APPROVED', oldValue: current, newValue: updated, ipAddress });
  return updated;
};

export const rejectWorkOrder = async (id: string, reason: string, userId?: string, ipAddress?: string) => {
  const current = await prisma.workOrder.findUniqueOrThrow({ where: { id } });
  assertNotLocked(current.isLocked);

  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      status: WorkOrderStatus.REJECTED,
      rejectionReason: reason,
    },
  });

  logAction({ workOrderId: id, userId, action: 'WORK_ORDER_REJECTED', oldValue: current, newValue: updated, ipAddress });
  return updated;
};

export const reopenWorkOrder = async (id: string, userId?: string, ipAddress?: string) => {
  const current = await prisma.workOrder.findUniqueOrThrow({ where: { id } });
  if (current.status !== WorkOrderStatus.REJECTED) {
    throw new Error('Only rejected work orders can be reopened');
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      status: WorkOrderStatus.IN_PROGRESS,
      rejectionReason: null,
      isLocked: false,
    },
  });

  logAction({ workOrderId: id, userId, action: 'WORK_ORDER_REOPENED', oldValue: current, newValue: updated, ipAddress });
  return updated;
};
