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
  getActiveTemplate,
  getByWorkOrder,
  getTemplate,
  listTemplates,
  reorderItems,
  resetSectionWeights,
  submitChecklist,
  updateSectionWeights,
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
 * /api/v1/checklists/active-template:
 *   get:
 *     summary: Get the single active checklist template
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Active template with ordered sections and items
 *       404:
 *         description: No active template found
 */
router.get(
  '/active-template',
  authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, UserRole.ADMIN, UserRole.REGULATOR),
  getActiveTemplate
);

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
router.get('/work-orders/:workOrderId', authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, UserRole.ADMIN, UserRole.REGULATOR), validate({ params: workOrderIdParamSchema }), getByWorkOrder);

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

/**
 * @swagger
 * /api/v1/checklists/templates/{id}:
 *   get:
 *     summary: Get a checklist template by id
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template with sections and items
 *       404:
 *         description: Not found
 */
router.get('/templates/:id', authorize(UserRole.ADMIN, UserRole.REGULATOR), validate({ params: idParamSchema }), getTemplate);

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

/**
 * @swagger
 * /api/v1/checklists/templates/{id}:
 *   patch:
 *     summary: Update a checklist template (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template updated
 */
router.patch('/templates/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), updateTemplate);

/**
 * @swagger
 * /api/v1/checklists/templates/{id}:
 *   delete:
 *     summary: Deactivate a checklist template (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template deactivated
 */
router.delete('/templates/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), deactivateTemplate);

/**
 * @swagger
 * /api/v1/checklists/templates/{id}/sections:
 *   post:
 *     summary: Add a section to a template (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Section created
 */
router.post('/templates/:id/sections', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), addSection);

/**
 * @swagger
 * /api/v1/checklists/templates/{id}/sections/{sectionId}:
 *   patch:
 *     summary: Update a template section (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Section updated
 */
router.patch('/templates/:id/sections/:sectionId', authorize(UserRole.ADMIN), updateSection);

/**
 * @swagger
 * /api/v1/checklists/templates/{id}/sections/{sectionId}:
 *   delete:
 *     summary: Delete a template section (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Section deleted
 */
router.delete('/templates/:id/sections/:sectionId', authorize(UserRole.ADMIN), deleteSection);

/**
 * @swagger
 * /api/v1/checklists/templates/{id}/sections/{sectionId}/items:
 *   post:
 *     summary: Add an item to a template section (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Item created
 */
router.post('/templates/:id/sections/:sectionId/items', authorize(UserRole.ADMIN), addItem);

/**
 * @swagger
 * /api/v1/checklists/templates/{id}/sections/{sectionId}/items/{itemId}:
 *   patch:
 *     summary: Update a checklist item (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Item updated
 */
router.patch('/templates/:id/sections/:sectionId/items/:itemId', authorize(UserRole.ADMIN), updateItem);

/**
 * @swagger
 * /api/v1/checklists/templates/{id}/sections/{sectionId}/items/{itemId}:
 *   delete:
 *     summary: Delete a checklist item (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Item deleted
 */
router.delete('/templates/:id/sections/:sectionId/items/:itemId', authorize(UserRole.ADMIN), deleteItem);
/**
 * @swagger
 * /api/v1/checklists/templates/{id}/sections/{sectionId}/items/reorder:
 *   post:
 *     summary: Reorder items within a section (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:    { type: string, format: uuid }
 *                     order: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Reordered successfully
 */
router.post('/templates/:id/sections/:sectionId/items/reorder', authorize(UserRole.ADMIN), reorderItems);

/**
 * @swagger
 * /api/v1/checklists/templates/{templateId}/weights:
 *   patch:
 *     summary: Bulk update section weights for a template (ADMIN only)
 *     description: All section weights must sum to exactly 1.0
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sections]
 *             properties:
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:     { type: string, format: uuid }
 *                     weight: { type: number, minimum: 0, maximum: 1 }
 *     responses:
 *       200:
 *         description: Weights updated — returns full template with updated sections
 *       400:
 *         description: Weights do not sum to 1.0
 */
router.patch('/templates/:templateId/weights', authorize(UserRole.ADMIN), updateSectionWeights);

/**
 * @swagger
 * /api/v1/checklists/templates/{templateId}/weights/reset:
 *   post:
 *     summary: Reset all section weights to their defaultWeight values (ADMIN only)
 *     tags: [Checklists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Weights reset to defaults
 */
router.post('/templates/:templateId/weights/reset', authorize(UserRole.ADMIN), resetSectionWeights);

export default router;
