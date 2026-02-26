import { NextFunction, Request, Response } from 'express';
import * as ContractorsService from '../services/contractors.service';
import { UpdateContractorStatusSchema } from '../services/contractors.service';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ContractorsService.listContractors({
      search: req.query.search as string | undefined,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ContractorsService.getContractorById(req.user!.dbUserId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ContractorsService.getContractorById(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ContractorsService.getContractorPerformance(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateContractorStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await ContractorsService.updateContractorStatus(req.params.id, parsed.data.isActive);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
