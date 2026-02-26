import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

const reportCache = new Map<string, any>();

export const GenerateReportSchema = z.object({
  type: z.enum(['COMPLIANCE', 'CONTRACTOR', 'INSPECTION']),
  dateFrom: z.string(),
  dateTo: z.string(),
  contractorId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  status: z.string().optional(),
});

export async function generateReport(params: z.infer<typeof GenerateReportSchema>, generatedBy: string) {
  const where: any = {
    createdAt: {
      gte: new Date(params.dateFrom),
      lte: new Date(params.dateTo),
    },
    ...(params.contractorId && { contractorId: params.contractorId }),
    ...(params.siteId && { siteId: params.siteId }),
    ...(params.status && { status: params.status as any }),
  };

  const workOrders = await prisma.workOrder.findMany({
    where,
    include: {
      site: { select: { name: true, region: true } },
      contractor: { select: { contractorId: true, companyName: true } },
      inspector: { select: { displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const scores = workOrders.map((w) => w.overallScore).filter(Boolean) as number[];

  const summary = {
    totalInspections: workOrders.length,
    avgScore: scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null,
    byStatus: workOrders.reduce((acc, wo) => {
      acc[wo.status] = (acc[wo.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byBand: workOrders.reduce((acc, wo) => {
      if (wo.complianceBand) acc[wo.complianceBand] = (acc[wo.complianceBand] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  const reportId = uuidv4();
  const report = {
    reportId,
    type: params.type,
    generatedAt: new Date().toISOString(),
    generatedBy,
    filters: params,
    summary,
    data: workOrders,
  };

  reportCache.set(reportId, report);
  return report;
}

export function listReports() {
  return Array.from(reportCache.values())
    .slice(-20)
    .reverse()
    .map((r) => ({
      reportId: r.reportId,
      type: r.type,
      generatedAt: r.generatedAt,
      generatedBy: r.generatedBy,
      filters: r.filters,
      summary: r.summary,
    }));
}

export function getReportById(id: string) {
  const report = reportCache.get(id);
  if (!report) throw new AppError('Report not found', 404);
  return report;
}
