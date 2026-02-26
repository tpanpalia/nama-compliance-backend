import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  confirmEvidenceUpload,
  deleteEvidenceHandler,
  getEvidenceByWorkOrder,
  requestPresignedUpload,
} from '../controllers/evidence.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { evidenceIdParamSchema, workOrderIdParamSchema } from '../schemas/common.schema';
import { confirmUploadSchema, requestUploadSchema } from '../schemas/evidence.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

/**
 * @swagger
 * /api/v1/evidence/work-orders/{workOrderId}:
 *   get:
 *     summary: List all evidence for a work order
 *     tags: [Evidence]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workOrderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Evidence grouped by source (INSPECTOR vs CONTRACTOR)
 */
router.get('/work-orders/:workOrderId/evidence', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: workOrderIdParamSchema }), getEvidenceByWorkOrder);

/**
 * @swagger
 * /api/v1/evidence/work-orders/{workOrderId}/presigned-upload:
 *   post:
 *     summary: Request a pre-signed S3 upload URL for photo or video evidence
 *     description: Validates file size and count limits. CONTRACTOR uploads also require GPS coordinates.
 *     tags: [Evidence]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workOrderId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileName, fileType, contentType, fileSize]
 *             properties:
 *               fileName:    { type: string, example: site_photo_001.jpg }
 *               fileType:    { type: string, enum: [PHOTO, VIDEO] }
 *               contentType: { type: string, example: image/jpeg }
 *               fileSize:    { type: integer, description: Size in bytes }
 *               latitude:    { type: number, description: Required for CONTRACTOR }
 *               longitude:   { type: number, description: Required for CONTRACTOR }
 *               accuracy:    { type: number, description: GPS accuracy in meters }
 *     responses:
 *       200:
 *         description: Returns uploadUrl, key, and evidenceId
 *       400:
 *         description: File too large or count limit reached
 */
router.post('/work-orders/:workOrderId/presigned-upload', authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR), validate({ params: workOrderIdParamSchema, body: requestUploadSchema }), requestPresignedUpload);

/**
 * @swagger
 * /api/v1/evidence/work-orders/{workOrderId}/confirm-upload:
 *   post:
 *     summary: Confirm that a file was successfully uploaded to S3
 *     tags: [Evidence]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workOrderId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [evidenceId, key]
 *             properties:
 *               evidenceId: { type: string }
 *               key:        { type: string }
 *     responses:
 *       200:
 *         description: Evidence confirmed and marked as uploaded
 *       400:
 *         description: File not found in S3
 */
router.post('/work-orders/:workOrderId/confirm-upload', authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR), validate({ params: workOrderIdParamSchema, body: confirmUploadSchema }), confirmEvidenceUpload);

/**
 * @swagger
 * /api/v1/evidence/{evidenceId}:
 *   delete:
 *     summary: Delete evidence (own evidence only, before approval)
 *     tags: [Evidence]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: evidenceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted from S3 and database
 *       423:
 *         description: Work order is locked — cannot delete evidence
 */
router.delete('/:evidenceId', authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR), validate({ params: evidenceIdParamSchema }), deleteEvidenceHandler);

export default router;
