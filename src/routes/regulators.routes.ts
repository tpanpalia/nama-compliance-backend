import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { create, getById, list, updateStatus } from '../controllers/regulators.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

/**
 * @swagger
 * /api/v1/regulators:
 *   get:
 *     summary: List regulators (ADMIN only)
 *     tags: [Regulators]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of regulator accounts
 */
router.get('/', authorize(UserRole.ADMIN), list);

/**
 * @swagger
 * /api/v1/regulators:
 *   post:
 *     summary: Create regulator account (ADMIN only)
 *     tags: [Regulators]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, displayName, organisation]
 *             properties:
 *               email:        { type: string, format: email }
 *               password:     { type: string, minLength: 8 }
 *               displayName:  { type: string }
 *               organisation: { type: string, example: APSR }
 *               department:   { type: string }
 *     responses:
 *       201:
 *         description: Regulator account created
 *       409:
 *         description: Email already exists
 */
router.post('/', authorize(UserRole.ADMIN), create);

router.get('/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), getById);

/**
 * @swagger
 * /api/v1/regulators/{id}/status:
 *   patch:
 *     summary: Activate or deactivate regulator (ADMIN only)
 *     tags: [Regulators]
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
router.patch('/:id/status', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), updateStatus);

export default router;
