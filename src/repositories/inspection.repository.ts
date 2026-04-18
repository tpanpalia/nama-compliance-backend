import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

export const inspectionRepository = {
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

  updateResponses: async (inspectionId: string, responses: { checklistItemId: string; rating?: string | null; inspectorComments?: string | null }[]) => {
    // Fetch question text for any items that may need to be created
    const itemIds = responses.map((r) => r.checklistItemId)
    const items = await prisma.checklistItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, question: true },
    })
    const questionMap = new Map(items.map((i) => [i.id, i.question]))

    return prisma.$transaction(
      responses.map((r) =>
        prisma.inspectionResponse.upsert({
          where: { inspectionId_checklistItemId: { inspectionId, checklistItemId: r.checklistItemId } },
          update: {
            ...(r.rating !== undefined && r.rating !== null ? { rating: r.rating as Parameters<typeof prisma.inspectionResponse.update>[0]['data']['rating'] } : {}),
            ...(r.inspectorComments !== undefined ? { inspectorComments: r.inspectorComments } : {}),
          },
          create: {
            inspectionId,
            checklistItemId:  r.checklistItemId,
            questionSnapshot: questionMap.get(r.checklistItemId) ?? '',
            ...(r.rating !== undefined && r.rating !== null ? { rating: r.rating as Parameters<typeof prisma.inspectionResponse.create>[0]['data']['rating'] } : {}),
            ...(r.inspectorComments !== undefined ? { inspectorComments: r.inspectorComments } : {}),
          },
        }),
      ),
    )
  },

  ensureResponses: async (inspectionId: string) => {
    const existing = await prisma.inspectionResponse.findMany({
      where: { inspectionId },
      select: { checklistItemId: true },
    })
    const existingIds = new Set(existing.map((r) => r.checklistItemId))

    const allItems = await prisma.checklistItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    })

    const missing = allItems.filter((item) => !existingIds.has(item.id))
    if (missing.length === 0) return

    await prisma.inspectionResponse.createMany({
      data: missing.map((item) => ({
        inspectionId,
        checklistItemId:  item.id,
        questionSnapshot: item.question,
      })),
    })
  },
}
