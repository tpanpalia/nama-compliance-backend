import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as ReportsController from '../controllers/reports.controller';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/reports/work-order/{workOrderId}:
 *   get:
 *     summary: Get Work Order Inspection Report data
 *     tags: [Reports]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workOrderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Full inspection report data for PDF generation
 *       400:
 *         description: Work order not approved yet
 *       404:
 *         description: Work order not found
 */
router.get(
  '/work-order/:workOrderId',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.REGULATOR),
  ReportsController.getWorkOrderReport
);

/**
 * @swagger
 * /api/v1/reports/contractor/{contractorId}:
 *   get:
 *     summary: Get Contractor Performance Summary Report data
 *     tags: [Reports]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: contractorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Contractor performance data for PDF generation
 */
router.get(
  '/contractor/:contractorId',
  authenticate,
  authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR),
  ReportsController.getContractorReport
);

/**
 * @swagger
 * /api/v1/reports/system-summary:
 *   get:
 *     summary: Get System Compliance Summary Report data
 *     tags: [Reports]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200:
 *         description: System-wide compliance data for PDF generation
 */
router.get(
  '/system-summary',
  authenticate,
  authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR),
  ReportsController.getSystemSummaryReport
);

export default router;
