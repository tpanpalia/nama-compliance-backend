import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

export const accessRequestRepository = {
  findById: (id: string) =>
    prisma.accessRequest.findUnique({ where: { id } }),

  findByIdWithFile: (id: string) =>
    prisma.accessRequest.findUnique({ where: { id }, include: { documentFile: true } }),

  findPendingByEmail: (email: string) =>
    prisma.accessRequest.findFirst({ where: { email, status: 'PENDING' } }),

  findMany: (params: { where: Prisma.AccessRequestWhereInput; skip: number; take: number }) =>
    prisma.accessRequest.findMany({
      where:   params.where,
      include: { documentFile: { select: { s3Key: true, mimeType: true } } },
      orderBy: { requestDate: 'desc' },
      skip:    params.skip,
      take:    params.take,
    }),

  count: (where: Prisma.AccessRequestWhereInput) =>
    prisma.accessRequest.count({ where }),

  create: (data: Parameters<typeof prisma.accessRequest.create>[0]['data']) =>
    prisma.accessRequest.create({ data }),

  approve: (id: string, reviewedBy: string) =>
    prisma.accessRequest.update({
      where: { id },
      data: {
        status: 'APPROVED', reviewedBy, reviewedAt: new Date(), verificationStatus: 'VERIFIED',
      },
    }),

  reject: (id: string, reviewedBy: string, reason: string) =>
    prisma.accessRequest.update({
      where: { id },
      data: {
        status: 'REJECTED', rejectionReason: reason, reviewedBy, reviewedAt: new Date(), verificationStatus: 'REJECTED',
      },
    }),
}
