import { prisma } from '../lib/prisma'

export const auditLogRepository = {
  create: (data: Parameters<typeof prisma.auditLog.create>[0]['data']) =>
    prisma.auditLog.create({ data }),
}
