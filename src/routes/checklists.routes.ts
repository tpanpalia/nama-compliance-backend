import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  addItem,
  addSection,
  autoSave,
  createTemplate,
  deactivateTemplate,
  deleteItem,
  deleteSection,
  getByWorkOrder,
  getTemplate,
  listTemplates,
  reorderItems,
  submitChecklist,
  updateItem,
  updateSection,
  updateTemplate,
} from '../controllers/checklists.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema, workOrderIdParamSchema } from '../schemas/common.schema';
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
router.get('/work-orders/:workOrderId', authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: workOrderIdParamSchema }), getByWorkOrder);

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
router.post('/work-orders/:workOrderId/auto-save', authorize(UserRole.INSPECTOR), validate({ params: workOrderIdParamSchema }), autoSave);

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
router.post('/work-orders/:workOrderId/submit', authorize(UserRole.INSPECTOR), validate({ params: workOrderIdParamSchema }), submitChecklist);

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
router.get('/templates/:id', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), getTemplate);

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
router.post('/templates', authorize(UserRole.ADMIN), createTemplate);
router.patch('/templates/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), updateTemplate);
router.delete('/templates/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), deactivateTemplate);

router.post('/templates/:id/sections', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), addSection);
router.patch('/templates/:id/sections/:sectionId', authorize(UserRole.ADMIN), updateSection);
router.delete('/templates/:id/sections/:sectionId', authorize(UserRole.ADMIN), deleteSection);

router.post('/templates/:id/sections/:sectionId/items', authorize(UserRole.ADMIN), addItem);
router.patch('/templates/:id/sections/:sectionId/items/:itemId', authorize(UserRole.ADMIN), updateItem);
router.delete('/templates/:id/sections/:sectionId/items/:itemId', authorize(UserRole.ADMIN), deleteItem);
router.patch('/templates/:id/reorder-items', authorize(UserRole.ADMIN), reorderItems);

export default router;
