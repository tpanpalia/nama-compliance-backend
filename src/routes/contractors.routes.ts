import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  getById,
  getMe,
  getPerformance,
  list,
  updateStatus,
} from '../controllers/contractors.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';
import { contractorStatusSchema } from '../schemas/contractor.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/contractors:
 *   get:
 *     summary: List contractors (ADMIN and REGULATOR)
 *     tags: [Contractors]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by company name or email
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated contractor list
 */
router.get('/', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), list);

/**
 * @swagger
 * /api/v1/contractors/me:
 *   get:
 *     summary: Get own contractor profile (CONTRACTOR only)
 *     tags: [Contractors]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Contractor profile and stats
 */
router.get('/me', authorize(EXTERNAL_USER_ROLES.CONTRACTOR), getMe);

/**
 * @swagger
 * /api/v1/contractors/{id}:
 *   get:
 *     summary: Get contractor by ID (ADMIN and REGULATOR)
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
 *         description: Contractor detail
 *       404:
 *         description: Not found
 */
router.get('/:id', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), getById);

/**
 * @swagger
 * /api/v1/contractors/{id}/performance:
 *   get:
 *     summary: Get contractor performance stats (ADMIN and REGULATOR)
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
 *         description: Returns totalInspections, avgScore, complianceByCategory
 */
router.get('/:id/performance', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), getPerformance);

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
router.patch('/:id/status', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: contractorStatusSchema }), updateStatus);

export default router;
