import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { dashboard } from '../controllers/stats.controller';
import { authorize } from '../middleware/authorize';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/stats/dashboard:
 *   get:
 *     summary: Get role-scoped dashboard stats
 *     description: Returns different data based on the authenticated user role. ADMIN sees system-wide stats. INSPECTOR sees their own work. CONTRACTOR sees their assigned jobs. REGULATOR sees read-only system overview.
 *     tags: [Stats]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats for the requesting user's role
 */
router.get('/dashboard', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), dashboard);

export default router;
