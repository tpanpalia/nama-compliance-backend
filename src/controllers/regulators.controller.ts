import { NextFunction, Request, Response } from 'express';
import * as RegulatorsService from '../services/regulators.service';
import { CreateRegulatorSchema, UpdateRegulatorStatusSchema } from '../services/regulators.service';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const data = await RegulatorsService.listRegulators({ isActive });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await RegulatorsService.getRegulatorById(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateRegulatorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await RegulatorsService.createRegulator(parsed.data);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateRegulatorStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await RegulatorsService.updateRegulatorStatus(req.params.id, parsed.data.isActive);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
