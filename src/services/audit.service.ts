import { prisma } from '../config/database';
import logger from '../config/logger';

interface AuditParams {
  workOrderId?: string;
  userId?: string;
  action: string;
  oldValue?: object;
  newValue?: object;
  ipAddress?: string;
}

export const logAction = (params: AuditParams): void => {
  void prisma.auditLog
    .create({
      data: {
        workOrderId: params.workOrderId,
        userId: params.userId,
        action: params.action,
        oldValue: params.oldValue,
        newValue: params.newValue,
        ipAddress: params.ipAddress,
      },
    })
    .catch((error: unknown) => {
      logger.error('Audit log write failed', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    });
};
