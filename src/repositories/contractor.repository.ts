import { prisma } from '../lib/prisma'
import { UserStatus, Prisma } from '@prisma/client'

export const contractorRepository = {
  findByCr: (crNumber: string) =>
    prisma.contractorProfile.findUnique({ where: { crNumber } }),

  findByCrFull: (crNumber: string) =>
    prisma.contractorProfile.findUnique({
      where: { crNumber },
      include: {
        user: { select: { id: true, status: true, lastLogin: true, createdAt: true } },
        workOrders: {
          include: {
            inspection: { select: { finalScore: true, complianceRating: true, status: true, submittedAt: true } },
            governorate: true,
          },
          orderBy: { allocationDate: 'desc' },
          take: 10,
        },
      },
    }),

  findByCrWithUser: (crNumber: string) =>
    prisma.contractorProfile.findUnique({
      where: { crNumber },
      select: { userId: true },
    }),

  findByUserId: (userId: string) =>
    prisma.contractorProfile.findUnique({
      where: { userId },
      select: { crNumber: true },
    }),

  findMany: (params: { where: Prisma.ContractorProfileWhereInput; skip: number; take: number }) =>
    prisma.contractorProfile.findMany({
      where:   params.where,
      include: { user: { select: { status: true, lastLogin: true, createdAt: true } } },
      orderBy: { companyName: 'asc' },
      skip:    params.skip,
      take:    params.take,
    }),

  findManyRegulator: (params: { where: Prisma.ContractorProfileWhereInput; skip: number; take: number }) =>
    prisma.contractorProfile.findMany({
      where:   params.where,
      include: { user: { select: { status: true } } },
      orderBy: { companyName: 'asc' },
      skip:    params.skip,
      take:    params.take,
    }),

  findByCrRegulator: (crNumber: string) =>
    prisma.contractorProfile.findUnique({
      where:   { crNumber },
      include: { user: { select: { status: true, createdAt: true } } },
    }),

  count: (where: Prisma.ContractorProfileWhereInput) =>
    prisma.contractorProfile.count({ where }),

  updateUserStatus: (userId: string, status: UserStatus) =>
    prisma.user.update({ where: { id: userId }, data: { status } }),

  update: (crNumber: string, data: {
    companyName?: string
    contactName?: string
    email?: string
    phone?: string
    address?: string
    regionsOfOperation?: string[]
  }) =>
    prisma.contractorProfile.update({ where: { crNumber }, data }),

  createWithUser: (data: Parameters<typeof prisma.user.create>[0]['data']) =>
    prisma.user.create({ data }),
}
