import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import * as ReportsService from '../services/reports.service';

function isMissingReportLogTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  );
}

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

export const generateReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.body;

    const REPORT_TYPE_MAP: Record<string, string> = {
      'performance-summary': 'Performance Summary',
      'contractor-performance': 'Contractor Performance',
    };

    const reportTypeName = REPORT_TYPE_MAP[type];

    if (!reportTypeName) {
      return res.status(400).json({
        error: `Unknown report type: ${type}`,
      });
    }

    const reportLog = await prisma.reportLog.findFirst({
      where: { reportType: reportTypeName },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        reportType: true,
        fileUrl: true,
        generatedAt: true,
        subject: true,
        period: true,
      },
    });

    if (!reportLog?.fileUrl) {
      return res.status(404).json({
        error: `No PDF found for ${reportTypeName}.`,
      });
    }

    return res.status(200).json({
      success: true,
      reportType: reportTypeName,
      fileUrl: reportLog.fileUrl,
      fileName:
        type === 'performance-summary'
          ? 'NAMA_Performance_Summary_Report.pdf'
          : 'NAMA_Contractor_Performance_Report.pdf',
      generatedAt: reportLog.generatedAt,
      subject: reportLog.subject,
      period: reportLog.period,
    });
  } catch (err) {
    console.error('[Reports] Error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve report',
      detail: err instanceof Error ? err.message : 'Unknown error',
    });
  }
};

export const getRecentReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let reports;
    try {
      reports = await prisma.reportLog.findMany({
        take: 20,
        orderBy: { generatedAt: 'desc' },
        include: {
          generatedByUser: {
            select: {
              displayName: true,
              identity: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      if (isMissingReportLogTableError(error)) {
        return res.json({ data: [] });
      }
      throw error;
    }

    return res.json({
      data: reports.map((report) => ({
        id: report.id,
        reportType: report.reportType,
        subject: report.subject,
        period: report.period,
        generatedBy: report.generatedByUser.displayName || report.generatedByUser.identity?.email || report.generatedBy,
        generatedAt: report.generatedAt,
        fileUrl: report.fileUrl,
        fileSize: report.fileSize,
      })),
    });
  } catch (err) {
    return next(err);
  }
};
