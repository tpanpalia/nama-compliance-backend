import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { getMyUserProfile, getUserById, listUsers, updateUserStatus } from '../controllers/users.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';
import { contractorStatusSchema } from '../schemas/contractor.schema';

const router = Router();

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get own user profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 */
router.get('/me', authorize(UserRole.INSPECTOR, UserRole.ADMIN), getMyUserProfile);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List internal users — Inspectors and Admins (ADMIN only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of internal users
 */
router.get('/', authorize(UserRole.ADMIN), listUsers);
router.get('/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), getUserById);

/**
 * @swagger
 * /api/v1/users/{id}/status:
 *   patch:
 *     summary: Activate or deactivate a user (ADMIN only)
 *     tags: [Users]
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
 *         description: User status updated
 */
router.patch('/:id/status', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: contractorStatusSchema }), updateUserStatus);

export default router;
