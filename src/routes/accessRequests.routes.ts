import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  approve,
  create,
  getById,
  list,
  reject,
} from '../controllers/accessRequests.controller';
import { authorize } from '../middleware/authorize';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';
import { accessRequestSchema, rejectRequestSchema } from '../schemas/contractor.schema';

const router = Router();

/**
 * @swagger
 * /api/v1/access-requests:
 *   post:
 *     summary: Submit a contractor registration request (PUBLIC — no auth needed)
 *     tags: [Access Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyName, tradeLicense, crNumber, contactName, email, phone]
 *             properties:
 *               companyName:  { type: string, example: Al Noor Construction }
 *               tradeLicense: { type: string, example: TL-2024-001 }
 *               crNumber:     { type: string, example: CR-123456 }
 *               contactName:  { type: string, example: Ali Al-Rashdi }
 *               email:        { type: string, format: email }
 *               phone:        { type: string, example: '+96891234567' }
 *     responses:
 *       201:
 *         description: Request submitted — pending admin review
 *       409:
 *         description: Email already has a pending or approved request
 */
router.post('/', validate({ body: accessRequestSchema }), create);
router.use(authenticate);

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
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: List of access requests
 */
router.get('/', authorize(UserRole.ADMIN), list);
router.get('/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), getById);

/**
 * @swagger
 * /api/v1/access-requests/{id}/approve:
 *   patch:
 *     summary: Approve request — creates Contractor account with generated C-XXXXX ID (ADMIN only)
 *     tags: [Access Requests]
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
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 description: Initial password to set for the contractor account
 *                 example: Welcome@123
 *     responses:
 *       200:
 *         description: Approved — Contractor record created with contractorId
 */
router.patch('/:id/approve', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), approve);

/**
 * @swagger
 * /api/v1/access-requests/{id}/reject:
 *   patch:
 *     summary: Reject access request (ADMIN only)
 *     tags: [Access Requests]
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
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Request rejected
 */
router.patch('/:id/reject', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: rejectRequestSchema }), reject);

export default router;
