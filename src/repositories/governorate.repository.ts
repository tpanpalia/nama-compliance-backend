import { prisma } from '../lib/prisma'

export const governorateRepository = {
  findAll: () =>
    prisma.governorate.findMany({ orderBy: { nameEn: 'asc' } }),

  findByCode: (code: string) =>
    prisma.governorate.findUnique({ where: { code } }),
}
