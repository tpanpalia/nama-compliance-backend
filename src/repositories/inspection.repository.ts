import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

export const inspectionRepository = {
  findById: (id: string) =>
    prisma.inspection.findUnique({ where: { id } }),

  findByIdWithWorkOrder: (id: string) =>
    prisma.inspection.findUnique({
      where:   { id },
      include: { workOrder: { select: { id: true, assignedInspectorId: true } } },
    }),

  findByIdFull: (id: string) =>
    prisma.inspection.findUnique({
      where: { id },
      include: {
        workOrder: {
          include: {
            contractor:     true,
            governorate:    true,
            scoringWeights: true,
            evidence: {
              where:   { uploadedByRole: 'CONTRACTOR' },
              include: { file: true, checklistItem: true },
            },
          },
        },
        responses: {
          include: { checklistItem: true },
          orderBy: [{ checklistItem: { category: 'asc' } }, { checklistItem: { order: 'asc' } }],
        },
        evidence: {
          where:   { uploadedByRole: 'INSPECTOR' },
          include: { file: true, checklistItem: true },
        },
      },
    }),

  findByIdWithScores: (id: string) =>
    prisma.inspection.findUnique({
      where: { id },
      include: {
        workOrder:  { include: { scoringWeights: true } },
        responses:  { include: { checklistItem: true } },
      },
    }),

  findByIdForEvidence: (id: string) =>
    prisma.inspection.findUnique({
      where:   { id },
      include: { workOrder: { select: { assignedInspectorId: true } } },
    }),

  findByWorkOrderId: (workOrderId: string) =>
    prisma.inspection.findUnique({ where: { workOrderId } }),

  findMany: (params: { where: Prisma.InspectionWhereInput; skip: number; take: number }) =>
    prisma.inspection.findMany({
      where: params.where,
      include: {
        workOrder: {
          include: {
            contractor:  { select: { companyName: true, crNumber: true } },
            governorate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip:    params.skip,
      take:    params.take,
    }),

  count: (where: Prisma.InspectionWhereInput) =>
    prisma.inspection.count({ where }),

  create: (data: Parameters<typeof prisma.inspection.create>[0]['data']) =>
    prisma.inspection.create({ data }),

  update: (id: string, data: Parameters<typeof prisma.inspection.update>[0]['data']) =>
    prisma.inspection.update({ where: { id }, data }),

  updateResponses: (inspectionId: string, responses: { checklistItemId: string; rating?: string | null; inspectorComments?: string | null }[]) =>
    prisma.$transaction(
      responses.map((r) =>
        prisma.inspectionResponse.updateMany({
          where: { inspectionId, checklistItemId: r.checklistItemId },
          data: {
            ...(r.rating !== undefined && r.rating !== null ? { rating: r.rating as Parameters<typeof prisma.inspectionResponse.updateMany>[0]['data']['rating'] } : {}),
            ...(r.inspectorComments !== undefined ? { inspectorComments: r.inspectorComments } : {}),
          },
        }),
      ),
    ),
}
