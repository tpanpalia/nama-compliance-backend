import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { dashboard } from '../controllers/stats.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/stats/dashboard:
 *   get:
 *     summary: Get role-based dashboard statistics
 *     tags: [Stats]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         description: Filter by year (ADMIN only, default current year)
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *         description: Filter by month (ADMIN only, omit for full year)
 *     responses:
 *       200:
 *         description: Dashboard data — shape depends on user role
 */
router.get(
  '/dashboard',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR),
  dashboard
);

export default router;
