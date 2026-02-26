import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { downloadReport, generateReport, getReportById, listReports } from '../controllers/reports.controller';
import { authorize } from '../middleware/authorize';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/reports:
 *   get:
 *     summary: List recent reports (ADMIN and REGULATOR)
 *     tags: [Reports]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Last 20 generated reports
 */
router.get('/', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), listReports);

/**
 * @swagger
 * /api/v1/reports/generate:
 *   post:
 *     summary: Generate a compliance report with filters
 *     tags: [Reports]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, dateFrom, dateTo]
 *             properties:
 *               type:         { type: string, enum: [COMPLIANCE, CONTRACTOR, INSPECTION] }
 *               dateFrom:     { type: string, format: date, example: '2026-01-01' }
 *               dateTo:       { type: string, format: date, example: '2026-03-31' }
 *               contractorId: { type: string, format: uuid }
 *               siteId:       { type: string, format: uuid }
 *               status:       { type: string }
 *     responses:
 *       200:
 *         description: Generated report with filtered work order data
 */
router.post('/generate', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), generateReport);
router.get('/:id', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), getReportById);
router.get('/:id/download', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), downloadReport);

export default router;
