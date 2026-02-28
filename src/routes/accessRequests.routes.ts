import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  approve,
  create,
  deactivateUser,
  getById,
  list,
  reject,
  rejectDocument,
  verifyDocument,
} from '../controllers/accessRequests.controller';
import { authorize } from '../middleware/authorize';
import { authenticate } from '../middleware/authenticate';

const router = Router();

/**
 * @swagger
 * /api/v1/access-requests:
 *   post:
 *     summary: Submit an access request (PUBLIC)
 *     tags: [Access Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [role, contactName, email, phone, companyName, tradeLicense, crNumber]
 *                 properties:
 *                   role:         { type: string, enum: [CONTRACTOR] }
 *                   contactName:  { type: string }
 *                   email:        { type: string, format: email }
 *                   phone:        { type: string }
 *                   companyName:  { type: string }
 *                   tradeLicense: { type: string }
 *                   crNumber:     { type: string }
 *               - type: object
 *                 required: [role, contactName, email, phone, organisation]
 *                 properties:
 *                   role:         { type: string, enum: [REGULATOR] }
 *                   contactName:  { type: string }
 *                   email:        { type: string, format: email }
 *                   phone:        { type: string }
 *                   organisation: { type: string }
 *                   department:   { type: string }
 *     responses:
 *       201:
 *         description: Access request submitted
 */
router.post('/', create);

/**
 * @swagger
 * /api/v1/access-requests:
 *   get:
 *     summary: List access requests (ADMIN only)
 *     tags: [Access Requests]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [CONTRACTOR, REGULATOR] }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated access requests with stats
 */
router.get('/', authenticate, authorize(UserRole.ADMIN), list);

/**
 * @swagger
 * /api/v1/access-requests/{id}:
 *   get:
 *     summary: Get access request detail by UUID or requestId (ADMIN only)
 *     tags: [Access Requests]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Access request detail
 *       404:
 *         description: Not found
 */
router.get('/:id', authenticate, authorize(UserRole.ADMIN), getById);

/**
 * @swagger
 * /api/v1/access-requests/{id}/approve:
 *   patch:
 *     summary: Approve access request (ADMIN only)
 *     tags: [Access Requests]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Approved and account created
 */
router.patch('/:id/approve', authenticate, authorize(UserRole.ADMIN), approve);

/**
 * @swagger
 * /api/v1/access-requests/{id}/reject:
 *   patch:
 *     summary: Reject access request (ADMIN only)
 *     tags: [Access Requests]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 5 }
 *     responses:
 *       200:
 *         description: Rejected
 */
router.patch('/:id/reject', authenticate, authorize(UserRole.ADMIN), reject);

/**
 * @swagger
 * /api/v1/access-requests/documents/{documentId}/verify:
 *   patch:
 *     summary: Verify access request document (ADMIN only)
 *     tags: [Access Requests]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Document marked VERIFIED
 */
router.patch('/documents/:documentId/verify', authenticate, authorize(UserRole.ADMIN), verifyDocument);

/**
 * @swagger
 * /api/v1/access-requests/documents/{documentId}/reject:
 *   patch:
 *     summary: Reject access request document (ADMIN only)
 *     tags: [Access Requests]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Document marked REJECTED
 */
router.patch('/documents/:documentId/reject', authenticate, authorize(UserRole.ADMIN), rejectDocument);

/**
 * @swagger
 * /api/v1/access-requests/{id}/deactivate:
 *   patch:
 *     summary: Deactivate approved contractor/regulator account linked to access request (ADMIN only)
 *     tags: [Access Requests]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deactivated
 */
router.patch('/:id/deactivate', authenticate, authorize(UserRole.ADMIN), deactivateUser);

export default router;
