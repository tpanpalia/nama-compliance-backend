import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import * as ReportsService from '../services/reports.service';
import { uploadReportPDF } from '../services/storage.service';
import { buildSimplePdf, generateWorkOrderInspectionPdf } from '../utils/simplePdf';

const toArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function buildSubject(contractors: Array<{ companyName: string }>, contractorIds: string[]): string {
  if (contractorIds.length === 0) return 'All Contractors';
  if (contractorIds.length === 1) return contractors[0]?.companyName ?? 'Contractor';
  return `${contractorIds.length} Contractors`;
}

function buildPeriod(years: number[], months: number[]): string {
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yearStr = years.length === 0 ? 'All Years' : years.join(', ');
  const monthStr = months.length === 0 ? '' : months.map((month) => monthNames[month] || String(month)).join(', ');
  return monthStr ? `${monthStr} ${yearStr}` : yearStr;
}

function isMissingReportLogTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  );
}

function normalizePdfData(
  label: string,
  subject: string,
  period: string,
  reportData: unknown
): {
  reportType: string;
  subject: string;
  period: string;
  workOrders: Array<{
    reference?: string | null;
    status?: string | null;
    overallScore?: number | null;
    submittedAt?: string | null;
    approvedAt?: string | null;
    site?: { name?: string | null } | null;
  }>;
  summary: {
    total: number;
    completed: number;
    submitted: number;
    avgScore: number | null;
  };
} {
  const data = (reportData ?? {}) as {
    workOrders?: Array<{
      reference?: string | null;
      status?: string | null;
      overallScore?: number | null;
      submittedAt?: string | null;
      approvedAt?: string | null;
      site?: { name?: string | null } | null;
    }>;
  };

  const workOrders = data.workOrders ?? [];
  const scored = workOrders.filter((wo) => typeof wo.overallScore === 'number');
  const avgScore =
    scored.length > 0
      ? scored.reduce((sum, wo) => sum + (wo.overallScore ?? 0), 0) / scored.length
      : null;

  return {
    reportType: label,
    subject,
    period,
    workOrders,
    summary: {
      total: workOrders.length,
      completed: workOrders.filter((wo) => wo.status === 'INSPECTION_COMPLETED').length,
      submitted: workOrders.filter((wo) => wo.status === 'SUBMITTED').length,
      avgScore: avgScore == null ? null : Math.round(avgScore * 10) / 10,
    },
  };
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
    const reportType = String(req.body.reportType ?? req.body.type ?? '');
    const workOrderId = req.body.workOrderId as string | undefined;
    const contractorIds = toArray<string>(req.body.contractorId).filter(Boolean);
    const regions = toArray<string>(req.body.regions).filter(Boolean);
    const years = toArray<number | string>(req.body.year)
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value));
    const months = toArray<number | string>(req.body.month)
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value));

    let reportData: unknown;
    let contractors: Array<{ companyName: string }> = [];

    if (reportType === 'WORK_ORDER_INSPECTION') {
      if (!workOrderId) {
        return res.status(400).json({
          error: 'workOrderId is required for this report type',
        });
      }

      const workOrder = await prisma.workOrder.findFirst({
        where: { id: workOrderId },
        include: {
          site: true,
          contractor: true,
          inspector: true,
        },
      });

      if (!workOrder) {
        return res.status(404).json({ error: 'Work order not found' });
      }

      const template = await prisma.checklistTemplate.findFirst({
        where: { isActive: true },
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      const allEvidence = await prisma.evidence.findMany({
        where: {
          workOrderId,
          isConfirmed: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const workOrderChecklist = await prisma.workOrderChecklist.findFirst({
        where: { workOrderId },
        include: { responses: true },
      });

      const evidenceByItem: Record<string, { contractor: typeof allEvidence; inspector: typeof allEvidence }> = {};
      for (const evidence of allEvidence) {
        if (!evidence.checklistItemId) continue;
        if (!evidenceByItem[evidence.checklistItemId]) {
          evidenceByItem[evidence.checklistItemId] = { contractor: [], inspector: [] };
        }
        if (evidence.source === 'CONTRACTOR') {
          evidenceByItem[evidence.checklistItemId].contractor.push(evidence);
        } else {
          evidenceByItem[evidence.checklistItemId].inspector.push(evidence);
        }
      }

      type InspectionResponseEntry = NonNullable<typeof workOrderChecklist> extends { responses: infer R }
        ? R extends Array<infer Item>
          ? Item
          : never
        : never;
      const responseByItem: Record<string, InspectionResponseEntry> = {};
      for (const response of workOrderChecklist?.responses ?? []) {
        responseByItem[response.itemId] = response;
      }

      const responses = workOrderChecklist?.responses ?? [];
      const ratingScore: Record<string, number> = {
        COMPLIANT: 100,
        PARTIAL: 60,
        NON_COMPLIANT: 0,
      };

      const sectionScores =
        template?.sections.map((section) => {
          const itemIds = section.items.map((item) => item.id);
          const sectionResponses = responses.filter((response) => itemIds.includes(response.itemId));
          const scored = sectionResponses.filter((response) => response.rating != null);
          const avg =
            scored.length > 0
              ? scored.reduce((sum, response) => sum + (ratingScore[response.rating as string] ?? 0), 0) / scored.length
              : 0;

          return {
            name: section.name,
            score: avg,
            rated: scored.length,
            total: itemIds.length,
          };
        }) ?? [];

      const pdfBuffer = await generateWorkOrderInspectionPdf({
        workOrder: {
          reference: workOrder.reference,
          status: workOrder.status,
          overallScore: workOrder.overallScore,
          scheduledDate: workOrder.scheduledDate,
          submittedAt: workOrder.submittedAt,
          site: {
            name: workOrder.site.name,
            location: workOrder.site.location,
          },
          contractor: workOrder.contractor
            ? {
                companyName: workOrder.contractor.companyName,
                crNumber: workOrder.contractor.crNumber,
              }
            : null,
          inspector: workOrder.inspector
            ? {
                displayName: workOrder.inspector.displayName,
                isActive: workOrder.inspector.isActive,
              }
            : null,
        },
        template: template
          ? {
              sections: template.sections.map((section) => ({
                name: section.name,
                weight: section.weight,
                items: section.items.map((item) => ({
                  id: item.id,
                  text: item.text,
                  weight: item.weight,
                })),
              })),
            }
          : null,
        evidenceByItem,
        responseByItem,
        summary: {
          total: responses.length,
          compliant: responses.filter((response) => response.rating === 'COMPLIANT').length,
          partial: responses.filter((response) => response.rating === 'PARTIAL').length,
          nonCompliant: responses.filter((response) => response.rating === 'NON_COMPLIANT').length,
        },
        sectionScores,
      });

      const subject = workOrder.site.name;
      const period = workOrder.submittedAt
        ? new Date(workOrder.submittedAt).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })
        : String(new Date().getFullYear());
      const filename = `Inspection_Report_${sanitizeFilenamePart(workOrder.reference)}.pdf`;

      try {
        const uploaded = await uploadReportPDF(pdfBuffer, 'work-order-inspection', filename);
        if (req.user?.dbUserId) {
          await prisma.reportLog.create({
            data: {
              reportType: 'Work Order Inspection',
              subject,
              period,
              generatedBy: req.user.dbUserId,
              fileKey: uploaded.key,
              fileUrl: uploaded.url,
              fileSize: uploaded.size,
              filters: {
                type: 'WORK_ORDER_INSPECTION',
                workOrderId,
              },
            },
          });
        }
      } catch (uploadErr) {
        console.error('Failed to save report log:', uploadErr);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    }

    switch (reportType) {
      case 'contractor-performance': {
        const result = await ReportsService.generateContractorPerformanceReport(contractorIds, years, months, regions);
        reportData = result.data;
        contractors = result.contractors as unknown as Array<{ companyName: string }>;
        break;
      }
      case 'performance-summary': {
        const result = await ReportsService.generatePerformanceSummaryReport(contractorIds, years, months, regions);
        reportData = result.data;
        contractors = result.contractors as unknown as Array<{ companyName: string }>;
        break;
      }
      default:
        return res.status(400).json({ error: 'Unsupported reportType' });
    }

    const reportTypeLabels: Record<string, string> = {
      'contractor-performance': 'Contractor Performance',
      'performance-summary': 'Performance Summary',
      'inspection-report': 'Inspection Report',
    };

    const subject = buildSubject(contractors, contractorIds);
    const period = buildPeriod(years, months);
    const label = reportTypeLabels[reportType] ?? reportType;
    const filename = `${sanitizeFilenamePart(label)}_${sanitizeFilenamePart(period)}.pdf`;
    const pdfData = normalizePdfData(label, subject, period, reportData);
    const pdf = await buildSimplePdf(pdfData);
    const uploaded = await uploadReportPDF(pdf, reportType, filename);

    if (req.user?.dbUserId) {
      try {
        await prisma.reportLog.create({
          data: {
            reportType: label,
            subject,
            period,
            generatedBy: req.user.dbUserId,
            fileKey: uploaded.key,
            fileUrl: uploaded.url,
            fileSize: uploaded.size,
            filters: {
              reportType,
              contractorIds,
              regions,
              years,
              months,
            },
          },
        });
      } catch (error) {
        if (!isMissingReportLogTableError(error)) {
          throw error;
        }
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    return next(err);
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
