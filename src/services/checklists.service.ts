import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const AutoSaveSchema = z.object({
  responses: z.array(
    z.object({
      itemId: z.string().uuid(),
      rating: z.enum(['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT']).nullable(),
      comment: z.string().optional(),
    })
  ),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

export const CreateSectionSchema = z.object({
  name: z.string().min(2),
  weight: z.number().min(0).max(1),
  order: z.number().int(),
});

export const CreateItemSchema = z.object({
  text: z.string().min(5),
  isRequired: z.boolean().default(true),
  order: z.number().int(),
});

export const ReorderItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int(),
    })
  ),
});

async function getActiveTemplate() {
  const template = await prisma.checklistTemplate.findFirst({
    where: { isActive: true },
    include: {
      sections: {
        orderBy: { order: 'asc' },
        include: { items: { orderBy: { order: 'asc' } } },
      },
    },
  });
  if (!template) throw new AppError('No active checklist template found', 404);
  return template;
}

export async function getChecklistForWorkOrder(workOrderId: string) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { checklist: { include: { responses: true } } },
  });
  if (!workOrder) throw new AppError('Work order not found', 404);

  const template = await getActiveTemplate();
  const responseMap = new Map((workOrder.checklist?.responses || []).map((r) => [r.itemId, r]));

  let total = 0;
  let answered = 0;
  let required = 0;
  let requiredAnswered = 0;

  const sectionsWithResponses = template.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      total++;
      if (item.isRequired) required++;
      const response = responseMap.get(item.id) || null;
      if (response?.rating) {
        answered++;
        if (item.isRequired) requiredAnswered++;
      }
      return { ...item, response };
    }),
  }));

  return {
    workOrderId,
    workOrderStatus: workOrder.status,
    isLocked: workOrder.isLocked,
    checklistId: workOrder.checklist?.id || null,
    isSubmitted: workOrder.checklist?.isSubmitted || false,
    lastSavedAt: workOrder.checklist?.lastSavedAt || null,
    template: { id: template.id, name: template.name, sections: sectionsWithResponses },
    completionStats: { total, answered, required, requiredAnswered },
  };
}

export async function autoSaveChecklist(workOrderId: string, responses: z.infer<typeof AutoSaveSchema>['responses']) {
  const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!workOrder) throw new AppError('Work order not found', 404);
  if (workOrder.isLocked) throw new AppError('Work order is locked', 423);

  const checklist = await prisma.workOrderChecklist.upsert({
    where: { workOrderId },
    update: { lastSavedAt: new Date() },
    create: { workOrderId, lastSavedAt: new Date() },
  });

  await prisma.$transaction(
    responses.map((r) =>
      prisma.checklistResponse.upsert({
        where: { checklistId_itemId: { checklistId: checklist.id, itemId: r.itemId } },
        update: { rating: r.rating, comment: r.comment },
        create: { checklistId: checklist.id, itemId: r.itemId, rating: r.rating, comment: r.comment },
      })
    )
  );

  return { savedAt: new Date(), responseCount: responses.length };
}

export async function submitChecklist(workOrderId: string) {
  const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!workOrder) throw new AppError('Work order not found', 404);
  if (workOrder.isLocked) throw new AppError('Work order is locked', 423);

  const template = await getActiveTemplate();
  const requiredItemIds = template.sections
    .flatMap((s) => s.items)
    .filter((i) => i.isRequired)
    .map((i) => i.id);

  const checklist = await prisma.workOrderChecklist.findUnique({
    where: { workOrderId },
    include: { responses: true },
  });

  const answeredIds = new Set((checklist?.responses || []).filter((r) => r.rating !== null).map((r) => r.itemId));
  const missingItems = requiredItemIds.filter((id) => !answeredIds.has(id));

  if (missingItems.length > 0) {
    throw new AppError(`Cannot submit — ${missingItems.length} required item(s) are incomplete`, 400);
  }

  const updated = await prisma.workOrderChecklist.update({
    where: { workOrderId },
    data: { isSubmitted: true, submittedAt: new Date() },
  });

  return { checklistId: updated.id, submittedAt: updated.submittedAt };
}

export async function listTemplates() {
  return prisma.checklistTemplate.findMany({
    include: { _count: { select: { sections: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTemplateById(id: string) {
  const template = await prisma.checklistTemplate.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { order: 'asc' },
        include: { items: { orderBy: { order: 'asc' } } },
      },
    },
  });
  if (!template) throw new AppError('Template not found', 404);
  return template;
}

export async function createTemplate(data: z.infer<typeof CreateTemplateSchema>) {
  return prisma.checklistTemplate.create({ data });
}

export async function updateTemplate(
  id: string,
  data: Partial<z.infer<typeof CreateTemplateSchema>> & { isActive?: boolean }
) {
  await getTemplateById(id);
  return prisma.checklistTemplate.update({ where: { id }, data });
}

export async function deactivateTemplate(id: string) {
  await getTemplateById(id);
  return prisma.checklistTemplate.update({ where: { id }, data: { isActive: false } });
}

export async function addSection(templateId: string, data: z.infer<typeof CreateSectionSchema>) {
  await getTemplateById(templateId);
  return prisma.checklistSection.create({ data: { ...data, templateId } });
}

export async function updateSection(sectionId: string, data: Partial<z.infer<typeof CreateSectionSchema>>) {
  return prisma.checklistSection.update({ where: { id: sectionId }, data });
}

export async function deleteSection(sectionId: string) {
  return prisma.checklistSection.delete({ where: { id: sectionId } });
}

export async function addItem(sectionId: string, data: z.infer<typeof CreateItemSchema>) {
  return prisma.checklistItem.create({ data: { ...data, sectionId } });
}

export async function updateItem(itemId: string, data: Partial<z.infer<typeof CreateItemSchema>>) {
  return prisma.checklistItem.update({ where: { id: itemId }, data });
}

export async function deleteItem(itemId: string) {
  return prisma.checklistItem.delete({ where: { id: itemId } });
}

export async function reorderItems(items: z.infer<typeof ReorderItemsSchema>['items']) {
  await prisma.$transaction(items.map((item) => prisma.checklistItem.update({ where: { id: item.id }, data: { order: item.order } })));
  return { reordered: items.length };
}
