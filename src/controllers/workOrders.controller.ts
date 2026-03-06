import { NextFunction, Request, Response } from 'express';
import * as WorkOrdersService from '../services/workOrders.service';
import {
  AssignContractorSchema,
  AssignInspectorSchema,
  CreateWorkOrderSchema,
} from '../services/workOrders.service';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await WorkOrdersService.listWorkOrders({
      userRole: req.user!.role,
      userEmail: req.user!.email,
      status: req.query.status as string | string[] | undefined,
      year: req.query.year as string | string[] | undefined,
      month: req.query.month as string | string[] | undefined,
      searchContractor: req.query.searchContractor as string,
      searchInspector: req.query.searchInspector as string,
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
    const data = await WorkOrdersService.getWorkOrderById(req.params.id, {
      userRole: req.user!.role,
      userEmail: req.user!.email,
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateWorkOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const data = await WorkOrdersService.createWorkOrder(parsed.data, req.user!.dbUserId!);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
};

export const assignContractor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AssignContractorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }
    const data = await WorkOrdersService.assignContractor(req.params.id, parsed.data.contractorId);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const assignInspector = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AssignInspectorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }
    const data = await WorkOrdersService.assignInspector(req.params.id, parsed.data.inspectorId);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const start = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await WorkOrdersService.startWorkOrder(req.params.id, req.user!.email, req.user!.dbUserId);
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

export const getStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await WorkOrdersService.getWorkOrderStats();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
