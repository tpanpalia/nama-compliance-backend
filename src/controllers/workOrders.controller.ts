import { NextFunction, Request, Response } from 'express';
import * as WorkOrdersService from '../services/workOrders.service';
import {
  AssignWorkOrderSchema,
  CreateWorkOrderSchema,
  RejectWorkOrderSchema,
} from '../services/workOrders.service';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await WorkOrdersService.listWorkOrders({
      role: req.user!.role as string,
      userId: req.user!.dbUserId!,
      status: req.query.status as string,
      inspectorId: req.query.inspectorId as string,
      contractorId: req.query.contractorId as string,
      siteId: req.query.siteId as string,
      priority: req.query.priority as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await WorkOrdersService.getWorkOrderById(
      req.params.id,
      req.user!.role as string,
      req.user!.dbUserId
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateWorkOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await WorkOrdersService.createWorkOrder(parsed.data, req.user!.dbUserId!);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
};

export const assign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AssignWorkOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await WorkOrdersService.assignWorkOrder(req.params.id, parsed.data, req.user!.dbUserId!);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const selfAssign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await WorkOrdersService.selfAssignWorkOrder(req.params.id, req.user!.dbUserId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const start = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await WorkOrdersService.startWorkOrder(req.params.id, req.user!.dbUserId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const submit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await WorkOrdersService.submitWorkOrder(req.params.id, req.user!.dbUserId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const approve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await WorkOrdersService.approveWorkOrder(req.params.id, req.user!.dbUserId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const reject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RejectWorkOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await WorkOrdersService.rejectWorkOrder(
      req.params.id,
      parsed.data.reason,
      req.user!.dbUserId!
    );
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const reopen = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await WorkOrdersService.reopenWorkOrder(req.params.id, req.user!.dbUserId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
