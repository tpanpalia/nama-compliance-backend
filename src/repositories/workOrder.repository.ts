import { prisma } from '../lib/prisma'
import { WorkOrderStatus, Prisma } from '@prisma/client'

export const workOrderRepository = {
  findById: (id: string) =>
    prisma.workOrder.findUnique({ where: { id } }),

  findByIdFull: (id: string) =>
    prisma.workOrder.findUnique({
      where: { id },
      include: {
        contractor:        true,
        assignedInspector: { include: { staffProfile: true } },
        governorate:       true,
        scoringWeights:    true,
        inspection: {
          include: {
            responses: {
              include: { checklistItem: true },
              orderBy:  [{ checklistItem: { category: 'asc' } }, { checklistItem: { order: 'asc' } }],
            },
            evidence: { include: { file: true } },
          },
        },
        evidence: { include: { file: true, checklistItem: true } },
      },
    }),

  findByIdForInspector: (id: string) =>
    prisma.workOrder.findUnique({
      where: { id },
      include: {
        contractor:  true,
        governorate: true,
        assignedInspector: { include: { staffProfile: true } },
        inspection: {
          include: {
            responses: {
              include: { checklistItem: true },
              orderBy:  [{ checklistItem: { category: 'asc' } }, { checklistItem: { order: 'asc' } }],
            },
            evidence: { include: { file: true } },
          },
        },
        evidence: {
          include: { file: true, checklistItem: true },
        },
      },
    }),

  findByIdForContractor: (id: string) =>
    prisma.workOrder.findUnique({
      where: { id },
      include: {
        governorate: true,
        inspection: {
          include: {
            responses: {
              select: {
                id: true, checklistItemId: true,
                questionSnapshot: true, rating: true,
              },
              orderBy: [{ checklistItem: { category: 'asc' } }, { checklistItem: { order: 'asc' } }],
            },
          },
        },
        evidence: {
          where:   { uploadedByRole: 'CONTRACTOR' },
          include: { file: { select: { id: true, s3Key: true, mimeType: true } }, checklistItem: true },
        },
      },
    }),

  findMany: (params: { where: Prisma.WorkOrderWhereInput; skip: number; take: number }) =>
    prisma.workOrder.findMany({
      where:   params.where,
      include: {
        contractor:        { select: { companyName: true } },
        assignedInspector: { select: { staffProfile: { select: { fullName: true } } } },
        governorate:       true,
        inspection:        { select: { finalScore: true, complianceRating: true, status: true, submittedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:    params.skip,
      take:    params.take,
    }),

  findManyForInspector: (params: { where: Prisma.WorkOrderWhereInput; skip: number; take: number }) =>
    prisma.workOrder.findMany({
      where:   params.where,
      include: {
        contractor:  { select: { companyName: true, crNumber: true } },
        governorate: true,
        inspection:  { select: { id: true, status: true, finalScore: true, complianceRating: true } },
      },
      orderBy: [{ priority: 'desc' }, { allocationDate: 'asc' }],
      skip:    params.skip,
      take:    params.take,
    }),

  findManyForContractor: (params: { where: Prisma.WorkOrderWhereInput; skip: number; take: number }) =>
    prisma.workOrder.findMany({
      where:   params.where,
      include: {
        governorate: true,
        inspection:  { select: { finalScore: true, complianceRating: true, status: true, submittedAt: true } },
      },
      orderBy: [{ status: 'asc' }, { allocationDate: 'desc' }],
      skip:    params.skip,
      take:    params.take,
    }),

  count: (where: Prisma.WorkOrderWhereInput) =>
    prisma.workOrder.count({ where }),

  create: (data: Parameters<typeof prisma.workOrder.create>[0]['data']) =>
    prisma.workOrder.create({ data }),

  update: (id: string, data: Parameters<typeof prisma.workOrder.update>[0]['data']) =>
    prisma.workOrder.update({ where: { id }, data }),

  updateStatus: (id: string, status: WorkOrderStatus) =>
    prisma.workOrder.update({ where: { id }, data: { status } }),
}
