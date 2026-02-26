import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { getConfig, updateConfig } from '../controllers/scoring.controller';
import { authorize } from '../middleware/authorize';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/scoring/config:
 *   get:
 *     summary: Get current scoring weights
 *     description: Returns the 4 category weights that must sum to 1.0 — HSE & Safety 0.40, Technical 0.30, Process 0.20, Site Closure 0.10
 *     tags: [Scoring]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current scoring config
 */
router.get('/config', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), getConfig);

/**
 * @swagger
 * /api/v1/scoring/config:
 *   patch:
 *     summary: Update scoring weights (ADMIN only) — must sum to 1.0
 *     tags: [Scoring]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [weights]
 *             properties:
 *               weights:
 *                 type: object
 *                 example:
 *                   HSE & Safety: 0.40
 *                   Technical Installation: 0.30
 *                   Process & Communication: 0.20
 *                   Site Closure: 0.10
 *     responses:
 *       200:
 *         description: Weights updated
 *       400:
 *         description: Weights do not sum to 1.0
 */
router.patch('/config', authorize(UserRole.ADMIN), updateConfig);

export default router;
