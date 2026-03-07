import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { create, getById, getMe, list, updateStatus } from '../controllers/users.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';

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
router.get('/me', authorize(UserRole.INSPECTOR, UserRole.ADMIN), getMe);

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
router.get('/', authorize(UserRole.ADMIN), list);

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create an internal user (ADMIN only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [displayName, email, password, role]
 *             properties:
 *               displayName: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               role:
 *                 type: string
 *                 enum: [ADMIN, INSPECTOR]
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/', authorize(UserRole.ADMIN), create);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get internal user by id (ADMIN only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User detail
 *       404:
 *         description: Not found
 */
router.get('/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), getById);

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
router.patch('/:id/status', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), updateStatus);

export default router;
