import { UserRole } from '@prisma/client';
import { Router } from 'express';
import * as contractorsController from '../controllers/contractors.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/contractors:
 *   get:
 *     summary: List contractors with computed stats (ADMIN and REGULATOR)
 *     tags: [Contractors]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [compliance, name, projects] }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Paginated contractor list with KPI stats
 */
router.get('/', authorize(UserRole.ADMIN, UserRole.REGULATOR), contractorsController.list);

router.get('/me', authorize(EXTERNAL_USER_ROLES.CONTRACTOR), contractorsController.getMe);

/**
 * @swagger
 * /api/v1/contractors/{id}:
 *   get:
 *     summary: Get contractor detail including performance summary (ADMIN and REGULATOR)
 *     tags: [Contractors]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Contractor detail with enriched metrics and performance object
 *       404:
 *         description: Not found
 */
router.get(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.REGULATOR),
  validate({ params: idParamSchema }),
  contractorsController.getById
);

/**
 * @swagger
 * /api/v1/contractors/{id}/performance:
 *   get:
 *     summary: Get contractor performance analytics (ADMIN and REGULATOR)
 *     tags: [Contractors]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Performance charts and inspection history
 *       404:
 *         description: Not found
 */
router.get(
  '/:id/performance',
  authorize(UserRole.ADMIN, UserRole.REGULATOR),
  validate({ params: idParamSchema }),
  contractorsController.getPerformance
);

/**
 * @swagger
 * /api/v1/contractors/{id}:
 *   patch:
 *     summary: Update contractor details (ADMIN only)
 *     tags: [Contractors]
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
 *               companyName: { type: string }
 *               email:       { type: string, format: email }
 *               phone:       { type: string }
 *               address:     { type: string }
 *     responses:
 *       200:
 *         description: Contractor updated
 *       409:
 *         description: Email already in use
 */
router.patch('/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), contractorsController.update);

/**
 * @swagger
 * /api/v1/contractors/{id}/status:
 *   patch:
 *     summary: Activate or deactivate contractor (ADMIN only)
 *     tags: [Contractors]
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
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/:id/status', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), contractorsController.updateStatus);

/**
 * @swagger
 * /api/v1/contractors/{id}:
 *   delete:
 *     summary: Delete contractor (ADMIN only)
 *     tags: [Contractors]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       400:
 *         description: Contractor has existing work orders
 */
router.delete('/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), contractorsController.remove);

export default router;
