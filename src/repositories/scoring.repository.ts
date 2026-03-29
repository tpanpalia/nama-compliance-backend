import { prisma } from '../lib/prisma'

export const scoringRepository = {
  findAll: () =>
    prisma.scoringWeight.findMany({ orderBy: { effectiveFrom: 'desc' } }),

  findActive: () =>
    prisma.scoringWeight.findFirst({ where: { effectiveTo: null }, orderBy: { effectiveFrom: 'desc' } }),

  closeActive: (effectiveTo: Date) =>
    prisma.scoringWeight.updateMany({ where: { effectiveTo: null }, data: { effectiveTo } }),

  create: (data: Parameters<typeof prisma.scoringWeight.create>[0]['data']) =>
    prisma.scoringWeight.create({ data }),
}
