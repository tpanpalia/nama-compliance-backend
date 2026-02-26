import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  approveWorkOrder,
  assignWorkOrder,
  createWorkOrder,
  listWorkOrders,
  rejectWorkOrder,
  reopenWorkOrder,
  selfAssignWorkOrder,
  startWorkOrder,
  submitWorkOrder,
} from '../services/workOrders.service';

export const getWorkOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, inspectorId, contractorId, siteId, priority, dateFrom, dateTo, page = 1, limit = 20 } = req.query as Record<string, string>;

    const filters: Prisma.WorkOrderWhereInput = {
      ...(status ? { status: status as Prisma.EnumWorkOrderStatusFilter['equals'] } : {}),
      ...(inspectorId ? { inspectorId } : {}),
      ...(contractorId ? { contractorId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(priority ? { priority: priority as Prisma.EnumWorkOrderPriorityFilter['equals'] } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const result = await listWorkOrders({
      userRole: req.user?.role || '',
      userId: req.user?.role === 'INSPECTOR' ? req.user.dbUserId : undefined,
      contractorId: req.user?.role === 'CONTRACTOR' ? req.user.dbUserId : undefined,
      filters,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      data: result.items,
      message: 'Work orders fetched successfully',
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workOrder = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        site: true,
        contractor: true,
        inspector: true,
        checklist: { include: { responses: true } },
        evidence: true,
      },
    });

    if (req.user?.role === 'CONTRACTOR' && workOrder.contractorId !== req.user.dbUserId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json({ data: workOrder, message: 'Work order fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const createWorkOrderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.dbUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const workOrder = await createWorkOrder(req.body, req.user.dbUserId);
    res.status(201).json({ data: workOrder, message: 'Work order created successfully' });
  } catch (error) {
    next(error);
  }
};

export const assignWorkOrderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workOrder = await assignWorkOrder(
      req.params.id,
      req.body.inspectorId,
      req.body.contractorId,
      req.user?.dbUserId,
      req.ip
    );
    res.json({ data: workOrder, message: 'Work order assigned successfully' });
  } catch (error) {
    next(error);
  }
};

export const selfAssignWorkOrderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.dbUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const workOrder = await selfAssignWorkOrder(req.params.id, req.user.dbUserId, req.user.dbUserId, req.ip);
    res.json({ data: workOrder, message: 'Work order self-assigned successfully' });
  } catch (error) {
    next(error);
  }
};

export const startWorkOrderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workOrder = await startWorkOrder(req.params.id, req.user?.dbUserId, req.ip);
    res.json({ data: workOrder, message: 'Work order started successfully' });
  } catch (error) {
    next(error);
  }
};

export const submitWorkOrderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.workOrder.findUniqueOrThrow({ where: { id: req.params.id } });
    if (existing.isLocked) {
      res.status(400).json({ error: 'Work order is locked and cannot be modified' });
      return;
    }
    const workOrder = await submitWorkOrder(req.params.id, req.user?.dbUserId, req.ip);
    res.json({ data: workOrder, message: 'Work order submitted successfully' });
  } catch (error) {
    next(error);
  }
};

export const approveWorkOrderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.dbUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const existing = await prisma.workOrder.findUniqueOrThrow({ where: { id: req.params.id } });
    if (existing.isLocked) {
      res.status(400).json({ error: 'Work order is locked and cannot be modified' });
      return;
    }
    const workOrder = await approveWorkOrder(req.params.id, req.user.dbUserId, req.user.dbUserId, req.ip);
    res.json({ data: workOrder, message: 'Work order approved successfully' });
  } catch (error) {
    next(error);
  }
};

export const rejectWorkOrderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.workOrder.findUniqueOrThrow({ where: { id: req.params.id } });
    if (existing.isLocked) {
      res.status(400).json({ error: 'Work order is locked and cannot be modified' });
      return;
    }
    const workOrder = await rejectWorkOrder(req.params.id, req.body.reason, req.user?.dbUserId, req.ip);
    res.json({ data: workOrder, message: 'Work order rejected successfully' });
  } catch (error) {
    next(error);
  }
};

export const reopenWorkOrderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.workOrder.findUniqueOrThrow({ where: { id: req.params.id } });
    if (existing.isLocked) {
      res.status(400).json({ error: 'Work order is locked and cannot be modified' });
      return;
    }
    const workOrder = await reopenWorkOrder(req.params.id, req.user?.dbUserId, req.ip);
    res.json({ data: workOrder, message: 'Work order reopened successfully' });
  } catch (error) {
    next(error);
  }
};
