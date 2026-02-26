import { NextFunction, Request, Response } from 'express';
import * as AccessRequestsService from '../services/accessRequests.service';
import {
  ApproveAccessRequestSchema,
  CreateAccessRequestSchema,
  RejectAccessRequestSchema,
} from '../services/accessRequests.service';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await AccessRequestsService.listAccessRequests(req.query.status as string | undefined);
    res.json({ data });
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
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await AccessRequestsService.createAccessRequest(parsed.data);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
};

export const approve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ApproveAccessRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await AccessRequestsService.approveAccessRequest(req.params.id, parsed.data.password);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const reject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RejectAccessRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await AccessRequestsService.rejectAccessRequest(req.params.id, parsed.data.reason);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
