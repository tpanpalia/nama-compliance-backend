import { NextFunction, Request, Response } from 'express';
import * as ChecklistsService from '../services/checklists.service';
import {
  AutoSaveSchema,
  CreateItemSchema,
  CreateSectionSchema,
  CreateTemplateSchema,
  ReorderItemsSchema,
} from '../services/checklists.service';

export const getByWorkOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ChecklistsService.getChecklistForWorkOrder(req.params.workOrderId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const autoSave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AutoSaveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await ChecklistsService.autoSaveChecklist(req.params.workOrderId, parsed.data.responses);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const submitChecklist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ChecklistsService.submitChecklist(req.params.workOrderId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const listTemplates = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await ChecklistsService.listTemplates() });
  } catch (err) {
    next(err);
  }
};

export const getTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await ChecklistsService.getTemplateById(req.params.id) });
  } catch (err) {
    next(err);
  }
};

export const deactivateTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await ChecklistsService.deactivateTemplate(req.params.id) });
  } catch (err) {
    next(err);
  }
};

export const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    res.status(201).json({ data: await ChecklistsService.createTemplate(parsed.data) });
  } catch (err) {
    next(err);
  }
};

export const updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await ChecklistsService.updateTemplate(req.params.id, req.body) });
  } catch (err) {
    next(err);
  }
};

export const addSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateSectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    res.status(201).json({ data: await ChecklistsService.addSection(req.params.id, parsed.data) });
  } catch (err) {
    next(err);
  }
};

export const updateSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await ChecklistsService.updateSection(req.params.sectionId, req.body) });
  } catch (err) {
    next(err);
  }
};

export const deleteSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ChecklistsService.deleteSection(req.params.sectionId);
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
};

export const addItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    res.status(201).json({ data: await ChecklistsService.addItem(req.params.sectionId, parsed.data) });
  } catch (err) {
    next(err);
  }
};

export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await ChecklistsService.updateItem(req.params.itemId, req.body) });
  } catch (err) {
    next(err);
  }
};

export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ChecklistsService.deleteItem(req.params.itemId);
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
};

export const reorderItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ReorderItemsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    res.json({ data: await ChecklistsService.reorderItems(parsed.data.items) });
  } catch (err) {
    next(err);
  }
};
