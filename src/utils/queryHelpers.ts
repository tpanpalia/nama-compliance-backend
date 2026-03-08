import { WorkOrderStatus } from '@prisma/client';

export const ACTIVE_WO_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'] as const;

export const activeProjectsFilter = {
  status: { in: [...ACTIVE_WO_STATUSES] as string[] },
};

export function getOverdueFilter() {
  return {
    scheduledDate: { lt: new Date() },
    status: {
      notIn: [WorkOrderStatus.INSPECTION_COMPLETED, WorkOrderStatus.REJECTED] as WorkOrderStatus[],
    },
  };
}
