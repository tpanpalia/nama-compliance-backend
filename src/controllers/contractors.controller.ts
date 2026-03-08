import { NextFunction, Request, Response } from 'express';
import * as ContractorsService from '../services/contractors.service';
import { CreateContractorSchema, UpdateContractorSchema, UpdateContractorStatusSchema } from '../services/contractors.service';

const VALID_REGIONS = [
  'Musandam',
  'Al Buraimi',
  'Al Dhahirah',
  'Al Dakhiliyah',
  'North Al Batinah',
  'South Al Batinah',
  'Muscat',
  'North Al Sharqiyah',
  'South Al Sharqiyah',
  'Al Wusta',
];

function normalizeRegions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((region): region is string => typeof region === 'string' && VALID_REGIONS.includes(region)) : [];
}

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ContractorsService.listContractors({
      search: req.query.search as string,
      status: req.query.status as string | string[] | undefined,
      isActive:
        req.query.isActive !== undefined
          ? (Array.isArray(req.query.isActive) ? req.query.isActive[0] : req.query.isActive) === 'true'
          : undefined,
      year: req.query.year as string | string[] | undefined,
      month: req.query.month as string | string[] | undefined,
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 20,
      sortBy: req.query.sortBy as string,
      sortDir: req.query.sortDir as string,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contractor = await ContractorsService.getContractorById(req.user!.contractorId!);
    res.json({ data: contractor });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contractor = await ContractorsService.getContractorById(req.params.id);
    const performance = await ContractorsService.getContractorPerformance(req.params.id);
    const enriched = await ContractorsService.enrichContractor(contractor as any);
    res.json({ data: { ...contractor, ...enriched, performance } });
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

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateContractorSchema.safeParse({
      ...req.body,
      regions: normalizeRegions(req.body.regions),
    });
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const data = await ContractorsService.createContractor(parsed.data);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateContractorSchema.safeParse({
      ...req.body,
      regions: req.body.regions !== undefined ? normalizeRegions(req.body.regions) : undefined,
    });
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const data = await ContractorsService.updateContractor(req.params.id, parsed.data);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateContractorStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }
    const data = await ContractorsService.updateContractorStatus(req.params.id, parsed.data.isActive);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ContractorsService.deleteContractor(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
