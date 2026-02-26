import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';

type TrendRow = { month: Date; avgScore: number | null };
type TopContractorRow = {
  contractorId: string;
  companyName: string;
  avgScore: number | null;
  totalInspections: number;
};

const getComplianceTrend = async (): Promise<Array<{ month: string; score: number }>> => {
  const trendRows = await prisma.$queryRaw<TrendRow[]>`
    SELECT date_trunc('month', "approvedAt") AS "month",
           AVG("overallScore") AS "avgScore"
    FROM "WorkOrder"
    WHERE "status" = 'APPROVED'
      AND "overallScore" IS NOT NULL
      AND "approvedAt" >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
    GROUP BY date_trunc('month', "approvedAt")
    ORDER BY date_trunc('month', "approvedAt") ASC
  `;

  return trendRows.map((row) => ({
    month: row.month.toISOString().slice(0, 7),
    score: Number(row.avgScore || 0),
  }));
};

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = req.user?.role;

    if (role === 'ADMIN') {
      const [totalWOs, activeContractors, avg, pendingReviews] = await Promise.all([
        prisma.workOrder.count(),
        prisma.contractor.count({ where: { isActive: true } }),
        prisma.workOrder.aggregate({ where: { status: 'APPROVED' }, _avg: { overallScore: true } }),
        prisma.workOrder.count({ where: { status: 'SUBMITTED' } }),
      ]);

      const monthlyTrend = await getComplianceTrend();

      res.json({
        data: {
          totalWOs,
          activeContractors,
          avgCompliance: avg._avg.overallScore || 0,
          pendingReviews,
          monthlyTrend,
          complianceByCategory: {},
        },
        message: 'Dashboard stats fetched successfully',
      });
      return;
    }

    if (role === 'REGULATOR') {
      const [systemTotal, systemAvgComplianceResult, complianceTrend, topContractors, pendingReviews] = await Promise.all([
        prisma.workOrder.count(),
        prisma.workOrder.aggregate({ where: { status: 'APPROVED' }, _avg: { overallScore: true } }),
        getComplianceTrend(),
        prisma.$queryRaw<TopContractorRow[]>`
          SELECT c."contractorId",
                 c."companyName",
                 AVG(w."overallScore") AS "avgScore",
                 COUNT(w."id")::int AS "totalInspections"
          FROM "Contractor" c
          JOIN "WorkOrder" w ON w."contractorId" = c."id"
          WHERE w."status" = 'APPROVED'
            AND w."overallScore" IS NOT NULL
          GROUP BY c."contractorId", c."companyName"
          ORDER BY AVG(w."overallScore") DESC
          LIMIT 5
        `,
        prisma.workOrder.count({ where: { status: 'SUBMITTED' } }),
      ]);

      res.json({
        data: {
          systemTotal,
          systemAvgCompliance: systemAvgComplianceResult._avg.overallScore || 0,
          complianceTrend,
          topContractors: topContractors.map((row) => ({
            contractorId: row.contractorId,
            companyName: row.companyName,
            avgScore: Number(row.avgScore || 0),
            totalInspections: row.totalInspections,
          })),
          pendingReviews,
        },
        message: 'Dashboard stats fetched successfully',
      });
      return;
    }

    if (role === 'INSPECTOR') {
      const [myAssigned, myInProgress, myCompleted, avg] = await Promise.all([
        prisma.workOrder.count({ where: { inspectorId: req.user?.dbUserId } }),
        prisma.workOrder.count({ where: { inspectorId: req.user?.dbUserId, status: 'IN_PROGRESS' } }),
        prisma.workOrder.count({ where: { inspectorId: req.user?.dbUserId, status: 'APPROVED' } }),
        prisma.workOrder.aggregate({ where: { inspectorId: req.user?.dbUserId }, _avg: { overallScore: true } }),
      ]);
      res.json({ data: { myAssigned, myInProgress, myCompleted, myAvgScore: avg._avg.overallScore || 0 }, message: 'Dashboard stats fetched successfully' });
      return;
    }

    if (role === 'CONTRACTOR') {
      const [myAssigned, mySubmitted, myCompleted, avg] = await Promise.all([
        prisma.workOrder.count({ where: { contractorId: req.user?.dbUserId } }),
        prisma.workOrder.count({ where: { contractorId: req.user?.dbUserId, status: 'SUBMITTED' } }),
        prisma.workOrder.count({ where: { contractorId: req.user?.dbUserId, status: 'APPROVED' } }),
        prisma.workOrder.aggregate({ where: { contractorId: req.user?.dbUserId }, _avg: { overallScore: true } }),
      ]);
      res.json({ data: { myAssigned, mySubmitted, myCompleted, myAvgScore: avg._avg.overallScore || 0 }, message: 'Dashboard stats fetched successfully' });
      return;
    }

    res.status(403).json({ error: 'Forbidden' });
  } catch (error) {
    next(error);
  }
};
