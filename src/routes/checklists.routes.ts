import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  addItem,
  addSection,
  autoSave,
  createTemplate,
  deleteTemplate,
  getChecklist,
  getTemplateById,
  listTemplates,
  removeItem,
  removeSection,
  reorderItems,
  submitChecklistHandler,
  updateItem,
  updateSection,
  updateTemplate,
} from '../controllers/checklists.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema, workOrderIdParamSchema } from '../schemas/common.schema';
import { autoSaveChecklistSchema, itemSchema, reorderItemsSchema, sectionSchema, templateSchema } from '../schemas/checklist.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

router.get('/work-orders/:workOrderId', authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: workOrderIdParamSchema }), getChecklist);
router.post('/work-orders/:workOrderId/auto-save', authorize(UserRole.INSPECTOR), validate({ params: workOrderIdParamSchema, body: autoSaveChecklistSchema }), autoSave);
router.post('/work-orders/:workOrderId/submit', authorize(UserRole.INSPECTOR), validate({ params: workOrderIdParamSchema }), submitChecklistHandler);

router.get('/templates', authorize(UserRole.ADMIN), listTemplates);
router.get('/templates/:id', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), getTemplateById);
router.post('/templates', authorize(UserRole.ADMIN), validate({ body: templateSchema }), createTemplate);
router.patch('/templates/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: templateSchema.partial() }), updateTemplate);
router.delete('/templates/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), deleteTemplate);

router.post('/templates/:id/sections', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: sectionSchema }), addSection);
router.patch('/templates/:id/sections/:sectionId', authorize(UserRole.ADMIN), validate({ body: sectionSchema.partial() }), updateSection);
router.delete('/templates/:id/sections/:sectionId', authorize(UserRole.ADMIN), removeSection);

router.post('/templates/:id/sections/:sectionId/items', authorize(UserRole.ADMIN), validate({ body: itemSchema }), addItem);
router.patch('/templates/:id/sections/:sectionId/items/:itemId', authorize(UserRole.ADMIN), validate({ body: itemSchema.partial() }), updateItem);
router.delete('/templates/:id/sections/:sectionId/items/:itemId', authorize(UserRole.ADMIN), removeItem);
router.patch('/templates/:id/reorder-items', authorize(UserRole.ADMIN), validate({ body: reorderItemsSchema }), reorderItems);

export default router;
