import { Router } from 'express';
import { login, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     description: Checks User table first (INSPECTOR/ADMIN), then Contractor table (CONTRACTOR). Returns JWT token and user info with role.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@nama.om
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful — returns token and user with role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:          { type: string }
 *                     email:       { type: string }
 *                     displayName: { type: string }
 *                     role:        { type: string, enum: [ADMIN, INSPECTOR, CONTRACTOR] }
 *                     isExternal:  { type: boolean }
 *       401:
 *         description: Invalid email or password
 *       403:
 *         description: Account deactivated
 */
router.post('/login', login);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Returns the logged-in user's profile based on their JWT token role.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticate, getMe);

export default router;
