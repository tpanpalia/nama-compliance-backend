import { prisma } from '../lib/prisma'
import { ChecklistCategory } from '@prisma/client'

export const checklistRepository = {
  findById: (id: string) =>
    prisma.checklistItem.findUnique({ where: { id } }),

  findMany: (where: { isActive?: boolean; category?: ChecklistCategory }) =>
    prisma.checklistItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    }),

  findAllActive: () =>
    prisma.checklistItem.findMany({
      where:   { isActive: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    }),

  create: (data: Parameters<typeof prisma.checklistItem.create>[0]['data']) =>
    prisma.checklistItem.create({ data }),

  deactivate: (id: string) =>
    prisma.checklistItem.update({ where: { id }, data: { isActive: false } }),

  findActiveVersion: () =>
    prisma.checklistVersion.findFirst({
      where:   { effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    }),
}
