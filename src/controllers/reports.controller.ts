import { NextFunction, Request, Response } from 'express';
import * as ReportsService from '../services/reports.service';

export const getWorkOrderReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ReportsService.getWorkOrderReportData(req.params.workOrderId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getContractorReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ReportsService.ContractorReportSchema.safeParse({
      contractorId: req.params.contractorId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const data = await ReportsService.getContractorReportData(
      parsed.data.contractorId,
      parsed.data.startDate,
      parsed.data.endDate
    );
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};

export const getSystemSummaryReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ReportsService.SystemSummaryReportSchema.safeParse({
      year: req.query.year,
      month: req.query.month,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }
    const data = await ReportsService.getSystemSummaryReportData(parsed.data.year, parsed.data.month);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};
