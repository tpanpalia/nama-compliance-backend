export const ACTIVE_WO_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'] as const;

export const activeProjectsFilter = {
  status: { in: [...ACTIVE_WO_STATUSES] as string[] },
};
