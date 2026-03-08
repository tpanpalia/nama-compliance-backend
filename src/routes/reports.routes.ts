import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as ReportsController from '../controllers/reports.controller';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

router.get(
  '/recent',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.REGULATOR),
  ReportsController.getRecentReports
);

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
  authorize(UserRole.ADMIN, UserRole.INSPECTOR, UserRole.REGULATOR),
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
  authorize(UserRole.ADMIN, UserRole.REGULATOR),
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
  authorize(UserRole.ADMIN, UserRole.REGULATOR),
  ReportsController.getSystemSummaryReport
);

/**
 * @swagger
 * /api/v1/reports/generate:
 *   post:
 *     summary: Generate and download a PDF report
 *     tags: [Reports]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [contractor-performance, performance-summary]
 *                 description: Report type for aggregate reports
 *               type:
 *                 type: string
 *                 enum: [WORK_ORDER_INSPECTION]
 *                 description: Alternate field used by the frontend for inspection report generation
 *               workOrderId:
 *                 type: string
 *                 format: uuid
 *               contractorId:
 *                 oneOf:
 *                   - type: string
 *                     format: uuid
 *                   - type: array
 *                     items:
 *                       type: string
 *                       format: uuid
 *               year:
 *                 oneOf:
 *                   - type: integer
 *                   - type: array
 *                     items:
 *                       type: integer
 *               month:
 *                 oneOf:
 *                   - type: integer
 *                     minimum: 1
 *                     maximum: 12
 *                   - type: array
 *                     items:
 *                       type: integer
 *                       minimum: 1
 *                       maximum: 12
 *               regions:
 *                 type: array
 *                 items:
 *                   type: string
 *           examples:
 *             contractorPerformance:
 *               summary: Contractor performance PDF
 *               value:
 *                 reportType: contractor-performance
 *                 contractorId:
 *                   - f61174b3-9692-4fcf-864c-0d83778768cc
 *                 year:
 *                   - 2026
 *                 month: []
 *                 regions:
 *                   - Muscat
 *                   - North Al Batinah
 *             workOrderInspection:
 *               summary: Single work order inspection PDF
 *               value:
 *                 type: WORK_ORDER_INSPECTION
 *                 workOrderId: 00000000-0000-0000-0000-000000000000
 *     responses:
 *       200:
 *         description: PDF file response
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid request or unsupported report type
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 */
router.post(
  '/generate',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.REGULATOR),
  ReportsController.generateReport
);

export default router;
