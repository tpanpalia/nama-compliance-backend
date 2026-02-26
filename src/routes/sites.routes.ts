import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { create, getById, list, nearbySites, update } from '../controllers/sites.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/sites:
 *   get:
 *     summary: List all active sites
 *     tags: [Sites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: region
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of sites
 */
router.get('/', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), list);
router.get('/nearby', authorize(EXTERNAL_USER_ROLES.CONTRACTOR), nearbySites);

/**
 * @swagger
 * /api/v1/sites/{id}:
 *   get:
 *     summary: Get site by ID
 *     tags: [Sites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Site detail
 *       404:
 *         description: Not found
 */
router.get('/:id', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), getById);

/**
 * @swagger
 * /api/v1/sites:
 *   post:
 *     summary: Create a site (ADMIN only)
 *     tags: [Sites]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, location, latitude, longitude, region]
 *             properties:
 *               name:      { type: string, example: Al Khoud Extension }
 *               location:  { type: string, example: Muscat, Oman }
 *               latitude:  { type: number, example: 23.5957 }
 *               longitude: { type: number, example: 58.1697 }
 *               region:    { type: string, example: Muscat }
 *     responses:
 *       201:
 *         description: Site created
 */
router.post('/', authorize(UserRole.ADMIN), create);
router.patch('/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), update);

export default router;
