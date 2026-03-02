import express from 'express';
import * as AuthController from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { loginRateLimiter, loginSlowDown } from '../config/security';

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     description: |
 *       Returns user info. JWT token is set as httpOnly cookie.
 *       Rate limited to 10 attempts per 15 minutes per IP+email.
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
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Never logged server-side
 *     responses:
 *       200:
 *         description: Login successful — token set in httpOnly cookie
 *       400:
 *         description: Missing or invalid fields
 *       401:
 *         description: Invalid credentials (generic — no enumeration)
 *       403:
 *         description: Account deactivated
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', loginSlowDown, loginRateLimiter, AuthController.login);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 */
router.get('/me', authenticate, AuthController.getMe);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout — clears auth cookie
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 */
router.post('/logout', authenticate, AuthController.logout);

export default router;
