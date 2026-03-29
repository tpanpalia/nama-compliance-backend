import { prisma } from '../lib/prisma'

export const evidenceRepository = {
  findById: (id: string) =>
    prisma.evidence.findUnique({
      where:   { id },
      include: { inspection: { select: { status: true } } },
    }),

  create: (data: Parameters<typeof prisma.evidence.create>[0]['data']) =>
    prisma.evidence.create({ data }),

  delete: (id: string) =>
    prisma.evidence.delete({ where: { id } }),

  countByWorkOrder: (workOrderId: string, uploadedByRole: 'CONTRACTOR' | 'INSPECTOR') =>
    prisma.evidence.count({ where: { workOrderId, uploadedByRole } }),
}
