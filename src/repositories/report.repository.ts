import { prisma } from '../lib/prisma'

export const reportRepository = {
  findManyExports: (skip: number, take: number) =>
    prisma.reportExport.findMany({
      include: { file: { select: { s3Key: true } } },
      orderBy: { generatedAt: 'desc' },
      skip,
      take,
    }),

  countExports: () =>
    prisma.reportExport.count(),
}
