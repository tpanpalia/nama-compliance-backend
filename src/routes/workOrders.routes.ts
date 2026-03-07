import { UserRole } from '@prisma/client';
import { Router } from 'express';
import * as workOrdersController from '../controllers/workOrders.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/work-orders:
 *   get:
 *     summary: List work orders with computed display status
 *     tags: [Work Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *       - in: query
 *         name: searchContractor
 *         schema: { type: string }
 *       - in: query
 *         name: searchInspector
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated work orders and dashboard stats
 */
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.INSPECTOR, UserRole.REGULATOR, EXTERNAL_USER_ROLES.CONTRACTOR),
  workOrdersController.list
);

/**
 * @swagger
 * /api/v1/work-orders:
 *   post:
 *     summary: Create work order (ADMIN only)
 *     tags: [Work Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [siteId]
 *             properties:
 *               siteId: { type: string, format: uuid }
 *               title: { type: string }
 *               priority: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *               scheduledDate: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Work order created
 */
router.post('/', authorize(UserRole.ADMIN), workOrdersController.create);

/**
 * @swagger
 * /api/v1/work-orders/stats:
 *   get:
 *     summary: Get work order KPI stats
 *     tags: [Work Orders]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Work order stats
 */
router.get('/stats', authorize(UserRole.ADMIN, UserRole.INSPECTOR), workOrdersController.getStats);

/**
 * @swagger
 * /api/v1/work-orders/{id}:
 *   get:
 *     summary: Get work order detail with grouped checklist sections
 *     tags: [Work Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Work order detail
 *       404:
 *         description: Not found
 */
router.get(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.INSPECTOR, UserRole.REGULATOR, EXTERNAL_USER_ROLES.CONTRACTOR),
  validate({ params: idParamSchema }),
  workOrdersController.getById
);

/**
 * @swagger
 * /api/v1/work-orders/{id}/assign-contractor:
 *   patch:
 *     summary: Assign contractor to work order (ADMIN only)
 *     tags: [Work Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractorId]
 *             properties:
 *               contractorId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Contractor assigned
 */
router.patch(
  '/:id/assign-contractor',
  authorize(UserRole.ADMIN),
  validate({ params: idParamSchema }),
  workOrdersController.assignContractor
);

/**
 * @swagger
 * /api/v1/work-orders/{id}/assign-inspector:
 *   patch:
 *     summary: Assign inspector to work order (ADMIN only)
 *     tags: [Work Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [inspectorId]
 *             properties:
 *               inspectorId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Inspector assigned
 */
router.patch(
  '/:id/assign-inspector',
  authorize(UserRole.ADMIN),
  validate({ params: idParamSchema }),
  workOrdersController.assignInspector
);

/**
 * @swagger
 * /api/v1/work-orders/{id}/submit:
 *   patch:
 *     summary: Submit work order for inspection (CONTRACTOR only)
 *     tags: [Work Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Work order submitted for inspection
 *       400:
 *         description: Invalid status or missing evidence
 *       404:
 *         description: Work order not found or not accessible
 */
router.patch(
  '/:id/submit',
  authorize(EXTERNAL_USER_ROLES.CONTRACTOR),
  validate({ params: idParamSchema }),
  workOrdersController.submitWorkOrder
);

export default router;
