import { NextFunction, Request, Response } from 'express';
import * as ReportsService from '../services/reports.service';
import { GenerateReportSchema } from '../services/reports.service';

export const generate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = GenerateReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await ReportsService.generateReport(parsed.data, req.user!.email);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ data: ReportsService.listReports() });
  } catch (err) {
    return next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = ReportsService.getReportById(req.params.id);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const download = async (req: Request, res: Response, next: NextFunction) => {
  try {
    ReportsService.getReportById(req.params.id);
    return res.json({
      data: {
        message: 'PDF generation available in Phase 2',
        downloadJson: `/api/v1/reports/${req.params.id}`,
      },
    });
  } catch (err) {
    return next(err);
  }
};
