import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { applyTemplateReorder, autoSaveChecklist, getChecklistByWorkOrder, submitChecklist, validateWeights } from '../services/checklists.service';

export const getChecklist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await getChecklistByWorkOrder(req.params.workOrderId);
    res.json({ data, message: 'Checklist fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const autoSave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await autoSaveChecklist(req.params.workOrderId, req.body.responses);
    res.json({ data, message: 'Checklist auto-saved successfully' });
  } catch (error) {
    next(error);
  }
};

export const submitChecklistHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await submitChecklist(req.params.workOrderId);
    res.json({ data, message: 'Checklist submitted successfully' });
  } catch (error) {
    next(error);
  }
};

export const listTemplates = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.checklistTemplate.findMany({
      include: { sections: { include: { items: true }, orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data, message: 'Templates fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const getTemplateById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.checklistTemplate.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { sections: { include: { items: true }, orderBy: { order: 'asc' } } },
    });
    res.json({ data, message: 'Template fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const createTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.checklistTemplate.create({ data: req.body });
    res.status(201).json({ data, message: 'Template created successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.checklistTemplate.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ data, message: 'Template updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const deleteTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.checklistTemplate.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ data, message: 'Template deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

export const addSection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.checklistSection.create({
      data: { ...req.body, templateId: req.params.id },
    });
    res.status(201).json({ data, message: 'Section added successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateSection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.checklistSection.update({
      where: { id: req.params.sectionId },
      data: req.body,
    });
    res.json({ data, message: 'Section updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const removeSection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.checklistSection.delete({ where: { id: req.params.sectionId } });
    res.json({ data: { deleted: true }, message: 'Section removed successfully' });
  } catch (error) {
    next(error);
  }
};

export const addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.checklistItem.create({
      data: { ...req.body, sectionId: req.params.sectionId },
    });
    res.status(201).json({ data, message: 'Item added successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.checklistItem.update({
      where: { id: req.params.itemId },
      data: req.body,
    });
    res.json({ data, message: 'Item updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.checklistItem.delete({ where: { id: req.params.itemId } });
    res.json({ data: { deleted: true }, message: 'Item removed successfully' });
  } catch (error) {
    next(error);
  }
};

export const reorderItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await applyTemplateReorder(req.params.id, req.body.items);
    res.json({ data: { updated: true }, message: 'Items reordered successfully' });
  } catch (error) {
    next(error);
  }
};

export const getScoringConfig = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.scoringConfig.findUnique({ where: { name: 'default' } });
    res.json({ data, message: 'Scoring config fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateScoringConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    validateWeights(req.body.weights);
    const sections = await prisma.checklistSection.findMany({
      where: { template: { isActive: true } },
      select: { name: true },
    });
    const validNames = new Set(sections.map((s) => s.name));
    for (const key of Object.keys(req.body.weights)) {
      if (!validNames.has(key)) {
        res.status(400).json({ error: `Invalid section name: ${key}` });
        return;
      }
    }

    const data = await prisma.scoringConfig.upsert({
      where: { name: 'default' },
      update: { weights: req.body.weights, updatedBy: req.user?.dbUserId },
      create: { name: 'default', weights: req.body.weights, updatedBy: req.user?.dbUserId },
    });

    res.json({ data, message: 'Scoring config updated successfully' });
  } catch (error) {
    next(error);
  }
};
