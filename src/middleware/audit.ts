import { NextFunction, Request, Response } from 'express';
import { logAction } from '../services/audit.service';

export const auditTrail = (action: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user) {
      logAction({
        workOrderId: req.params.id || req.params.workOrderId,
        userId: req.user.dbUserId,
        action,
        ipAddress: req.ip,
      });
    }
    next();
  };
};
