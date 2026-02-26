import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = req.user?.role;

    if (role === 'ADMIN') {
      const [totalWOs, activeContractors, avg, pendingReviews] = await Promise.all([
        prisma.workOrder.count(),
        prisma.contractor.count({ where: { isActive: true } }),
        prisma.workOrder.aggregate({ _avg: { overallScore: true } }),
        prisma.workOrder.count({ where: { status: 'SUBMITTED' } }),
      ]);

      const monthly = await prisma.workOrder.findMany({
        where: { createdAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } },
        select: { createdAt: true, overallScore: true },
      });

      const monthlyTrend = monthly.map((m) => ({ month: m.createdAt.toISOString().slice(0, 7), score: m.overallScore || 0 }));

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

    const [systemTotalWOs, systemAvg] = await Promise.all([
      prisma.workOrder.count(),
      prisma.workOrder.aggregate({ _avg: { overallScore: true } }),
    ]);

    const topContractors = await prisma.contractor.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, contractorId: true, companyName: true },
    });

    const complianceTrend = await prisma.workOrder.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, overallScore: true },
    });

    res.json({
      data: {
        systemTotalWOs,
        systemAvgCompliance: systemAvg._avg.overallScore || 0,
        topContractors,
        complianceTrend: complianceTrend.map((x) => ({ month: x.createdAt.toISOString().slice(0, 7), score: x.overallScore || 0 })),
      },
      message: 'Dashboard stats fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};
