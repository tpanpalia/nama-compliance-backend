import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  approveWorkOrderHandler,
  assignWorkOrderHandler,
  createWorkOrderHandler,
  getWorkOrderById,
  getWorkOrders,
  rejectWorkOrderHandler,
  reopenWorkOrderHandler,
  selfAssignWorkOrderHandler,
  startWorkOrderHandler,
  submitWorkOrderHandler,
} from '../controllers/workOrders.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { assignWorkOrderSchema, createWorkOrderSchema, rejectWorkOrderSchema, workOrderFilterSchema } from '../schemas/workOrder.schema';
import { idParamSchema } from '../schemas/common.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/work-orders:
 *   get:
 *     summary: List work orders (role-scoped)
 *     description: ADMIN and REGULATOR see all work orders. INSPECTOR sees assigned + pool. CONTRACTOR sees only their own.
 *     tags: [Work Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ASSIGNED, IN_PROGRESS, SUBMITTED, APPROVED, REJECTED, REOPENED]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of work orders
 *       401:
 *         description: Unauthorized
 */
router.get('/', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), validate({ query: workOrderFilterSchema }), getWorkOrders);

/**
 * @swagger
 * /api/v1/work-orders/{id}:
 *   get:
 *     summary: Get work order by ID
 *     tags: [Work Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Work order detail
 *       404:
 *         description: Not found
 */
router.get('/:id', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), getWorkOrderById);

/**
 * @swagger
 * /api/v1/work-orders:
 *   post:
 *     summary: Create a work order (ADMIN only)
 *     tags: [Work Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, siteId]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Al Khoud Pipeline Inspection
 *               siteId:
 *                 type: string
 *                 format: uuid
 *               contractorId:
 *                 type: string
 *                 format: uuid
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                 default: MEDIUM
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Work order created
 *       400:
 *         description: Validation error
 */
router.post('/', authorize(UserRole.ADMIN), validate({ body: createWorkOrderSchema }), createWorkOrderHandler);

/**
 * @swagger
 * /api/v1/work-orders/{id}/assign:
 *   patch:
 *     summary: Assign inspector and contractor to work order (ADMIN only)
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
 *             properties:
 *               inspectorId: { type: string, format: uuid }
 *               contractorId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assigned successfully
 */
router.patch('/:id/assign', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: assignWorkOrderSchema }), assignWorkOrderHandler);

/**
 * @swagger
 * /api/v1/work-orders/{id}/self-assign:
 *   post:
 *     summary: Inspector takes a pending work order from the pool
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
 *         description: Work order assigned to requesting inspector
 *       400:
 *         description: Work order already assigned or not in PENDING status
 */
router.post('/:id/self-assign', authorize(UserRole.INSPECTOR), validate({ params: idParamSchema }), selfAssignWorkOrderHandler);

/**
 * @swagger
 * /api/v1/work-orders/{id}/start:
 *   patch:
 *     summary: Mark work order as IN_PROGRESS (INSPECTOR only)
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
 *         description: Status changed to IN_PROGRESS
 */
router.patch('/:id/start', authorize(UserRole.INSPECTOR), validate({ params: idParamSchema }), startWorkOrderHandler);

/**
 * @swagger
 * /api/v1/work-orders/{id}/submit:
 *   post:
 *     summary: Submit completed inspection (INSPECTOR only)
 *     description: Validates checklist is fully completed then calculates weighted compliance score.
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
 *         description: Submitted with overallScore and complianceBand calculated
 *       400:
 *         description: Checklist incomplete — lists missing required items
 *       423:
 *         description: Work order is locked
 */
router.post('/:id/submit', authorize(UserRole.INSPECTOR), validate({ params: idParamSchema }), submitWorkOrderHandler);

/**
 * @swagger
 * /api/v1/work-orders/{id}/approve:
 *   patch:
 *     summary: Approve submitted inspection (ADMIN only) — locks the record permanently
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
 *         description: Approved — isLocked set to true, record is now immutable
 */
router.patch('/:id/approve', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), approveWorkOrderHandler);

/**
 * @swagger
 * /api/v1/work-orders/{id}/reject:
 *   patch:
 *     summary: Reject submitted inspection (ADMIN only)
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
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 example: PPE documentation missing from evidence
 *     responses:
 *       200:
 *         description: Rejected with reason recorded
 */
router.patch('/:id/reject', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: rejectWorkOrderSchema }), rejectWorkOrderHandler);

/**
 * @swagger
 * /api/v1/work-orders/{id}/reopen:
 *   patch:
 *     summary: Reopen a rejected work order (ADMIN only)
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
 *         description: Status reset to IN_PROGRESS
 */
router.patch('/:id/reopen', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), reopenWorkOrderHandler);

export default router;
