import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../config/database';
import { generateDownloadPresignedUrl } from '../services/s3.service';

interface ReportStore {
  id: string;
  type: string;
  filters: Record<string, unknown>;
  generatedAt: string;
  key: string;
}

const reports = new Map<string, ReportStore>();

export const listReports = async (_req: Request, res: Response): Promise<void> => {
  const data = Array.from(reports.values());
  res.json({ data, message: 'Reports fetched successfully' });
};

export const generateReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = randomUUID();
    const key = `reports/${id}.csv`;
    const report: ReportStore = {
      id,
      type: req.body.type,
      filters: req.body,
      generatedAt: new Date().toISOString(),
      key,
    };

    if (req.body.contractorId) {
      await prisma.contractor.findUniqueOrThrow({ where: { id: req.body.contractorId } });
    }

    reports.set(id, report);
    res.status(201).json({ data: report, message: 'Report generated successfully' });
  } catch (error) {
    next(error);
  }
};

export const getReportById = async (req: Request, res: Response): Promise<void> => {
  const data = reports.get(req.params.id);
  if (!data) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  res.json({ data, message: 'Report fetched successfully' });
};

export const downloadReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const report = reports.get(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    const data = await generateDownloadPresignedUrl(report.key);
    res.json({ data, message: 'Report download URL generated successfully' });
  } catch (error) {
    next(error);
  }
};
