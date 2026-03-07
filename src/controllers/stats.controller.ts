import { NextFunction, Request, Response } from 'express';
import * as StatsService from '../services/stats.service';

export const dashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role as string;
    const userId = req.user!.dbUserId;
    const contractorId = req.user!.contractorId;

    let data;
    switch (role) {
      case 'ADMIN': {
        const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
        const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
        data = await StatsService.getAdminDashboard({ year, month });
        break;
      }
      case 'INSPECTOR':
        data = await StatsService.getInspectorDashboard(userId!);
        break;
      case 'CONTRACTOR':
        if (!contractorId) {
          return res.status(403).json({
            error: 'Contractor profile not found',
          });
        }
        data = await StatsService.getContractorDashboard(contractorId!);
        break;
      case 'REGULATOR':
        data = await StatsService.getRegulatorDashboard();
        break;
      default:
        data = await StatsService.getAdminDashboard({});
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
};
