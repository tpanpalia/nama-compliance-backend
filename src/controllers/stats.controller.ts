import { NextFunction, Request, Response } from 'express';
import * as StatsService from '../services/stats.service';

export const dashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role as string;
    const userId = req.user!.dbUserId!;

    let data;
    switch (role) {
      case 'ADMIN':
        data = await StatsService.getAdminDashboard();
        break;
      case 'INSPECTOR':
        data = await StatsService.getInspectorDashboard(userId);
        break;
      case 'CONTRACTOR':
        data = await StatsService.getContractorDashboard(userId);
        break;
      case 'REGULATOR':
      default:
        data = await StatsService.getRegulatorDashboard();
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
};
