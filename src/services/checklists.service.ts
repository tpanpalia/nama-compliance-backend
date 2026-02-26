import { ChecklistResponse, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { calculateComplianceScore } from './scoring.service';

export const getChecklistByWorkOrder = async (workOrderId: string) => {
  const template = await prisma.checklistTemplate.findFirst({
    where: { isActive: true },
    include: {
      sections: {
        include: { items: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  });

  const checklist = await prisma.workOrderChecklist.upsert({
    where: { workOrderId },
    update: {},
    create: { workOrderId },
    include: {
      responses: true,
    },
  });

  return { template, checklist };
};

export const autoSaveChecklist = async (
  workOrderId: string,
  responses: Array<{ itemId: string; rating: ChecklistResponse['rating']; comment?: string }>
) => {
  const workOrder = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (workOrder.isLocked) {
    throw new Error('Work order is locked and cannot be modified');
  }

  const checklist = await prisma.workOrderChecklist.upsert({
    where: { workOrderId },
    update: { lastSavedAt: new Date() },
    create: { workOrderId, lastSavedAt: new Date() },
  });

  await prisma.$transaction(
    responses.map((response) =>
      prisma.checklistResponse.upsert({
        where: {
          checklistId_itemId: {
            checklistId: checklist.id,
            itemId: response.itemId,
          },
        },
        update: {
          rating: response.rating,
          comment: response.comment,
        },
        create: {
          checklistId: checklist.id,
          itemId: response.itemId,
          rating: response.rating,
          comment: response.comment,
        },
      })
    )
  );

  return prisma.workOrderChecklist.findUnique({
    where: { id: checklist.id },
    include: { responses: true },
  });
};

export const submitChecklist = async (workOrderId: string) => {
  const checklist = await prisma.workOrderChecklist.findUniqueOrThrow({
    where: { workOrderId },
    include: {
      responses: {
        include: {
          item: {
            include: { section: true },
          },
        },
      },
    },
  });

  const scoringInput = checklist.responses.map((r) => ({
    sectionName: r.item.section.name,
    sectionWeight: r.item.section.weight,
    isRequired: r.item.isRequired,
    rating: r.rating,
  }));

  const score = calculateComplianceScore(scoringInput);

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      overallScore: score.overallScore,
      complianceBand: score.complianceBand,
    },
  });

  return prisma.workOrderChecklist.update({
    where: { id: checklist.id },
    data: {
      isSubmitted: true,
      submittedAt: new Date(),
      lastSavedAt: new Date(),
    },
    include: { responses: true },
  });
};

export const validateWeights = (weights: Record<string, number>): void => {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.001) {
    throw new Error('Weights must sum to 1.0');
  }
};

export const applyTemplateReorder = async (
  templateId: string,
  items: Array<{ id: string; sectionId: string; order: number }>
) => {
  return prisma.$transaction(
    items.map((item) =>
      prisma.checklistItem.updateMany({
        where: { id: item.id, sectionId: item.sectionId, section: { templateId } },
        data: { order: item.order },
      })
    )
  );
};
