import { NextFunction, Request, Response } from 'express';
import * as AccessRequestsService from '../services/accessRequests.service';
import {
  ApproveRequestSchema,
  CreateAccessRequestSchema,
  RejectRequestSchema,
} from '../services/accessRequests.service';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AccessRequestsService.listAccessRequests({
      status: req.query.status as string,
      role: req.query.role as string,
      year: req.query.year ? parseInt(req.query.year as string, 10) : undefined,
      month: req.query.month ? parseInt(req.query.month as string, 10) : undefined,
      search: req.query.search as string,
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
    const data = await AccessRequestsService.getAccessRequestById(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateAccessRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const data = await AccessRequestsService.createAccessRequest(parsed.data);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
};

export const approve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ApproveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await AccessRequestsService.approveAccessRequest(req.params.id, parsed.data.password);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const reject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RejectRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await AccessRequestsService.rejectAccessRequest(req.params.id, parsed.data.reason);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const verifyDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await AccessRequestsService.verifyDocument(req.params.documentId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const rejectDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await AccessRequestsService.rejectDocument(req.params.documentId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const deactivateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await AccessRequestsService.deactivateUser(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
