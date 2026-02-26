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

/**
 * @swagger
 * /api/v1/checklists/work-orders/{workOrderId}:
 *   get:
 *     summary: Get checklist for a work order with all items and current responses
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workOrderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Checklist with sections, items, and current responses
 */
router.get('/work-orders/:workOrderId', authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: workOrderIdParamSchema }), getChecklist);

/**
 * @swagger
 * /api/v1/checklists/work-orders/{workOrderId}/auto-save:
 *   post:
 *     summary: Auto-save checklist progress (INSPECTOR only — called every 30s from mobile)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workOrderId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [responses]
 *             properties:
 *               responses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:  { type: string }
 *                     rating:  { type: string, enum: [COMPLIANT, PARTIAL, NON_COMPLIANT] }
 *                     comment: { type: string }
 *     responses:
 *       200:
 *         description: Progress saved — returns savedAt and responseCount
 */
router.post('/work-orders/:workOrderId/auto-save', authorize(UserRole.INSPECTOR), validate({ params: workOrderIdParamSchema, body: autoSaveChecklistSchema }), autoSave);

/**
 * @swagger
 * /api/v1/checklists/work-orders/{workOrderId}/submit:
 *   post:
 *     summary: Final checklist submission (INSPECTOR only)
 *     description: Validates all required items are rated before accepting. Once submitted, triggers score calculation on the work order.
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workOrderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Checklist submitted
 *       400:
 *         description: Incomplete — lists which required items are missing ratings
 */
router.post('/work-orders/:workOrderId/submit', authorize(UserRole.INSPECTOR), validate({ params: workOrderIdParamSchema }), submitChecklistHandler);

/**
 * @swagger
 * /api/v1/checklists/templates:
 *   get:
 *     summary: List all checklist templates (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of templates
 */
router.get('/templates', authorize(UserRole.ADMIN), listTemplates);
router.get('/templates/:id', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), getTemplateById);

/**
 * @swagger
 * /api/v1/checklists/templates:
 *   post:
 *     summary: Create a new checklist template (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string, example: Standard Compliance Inspection }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Template created
 */
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
