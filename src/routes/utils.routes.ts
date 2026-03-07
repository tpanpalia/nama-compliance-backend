import { Router } from 'express';
import { getReverseGeocode } from '../controllers/utils.controller';

const router = Router();

/**
 * @swagger
 * /api/v1/utils/reverse-geocode:
 *   get:
 *     summary: Reverse geocode coordinates into a human-readable place name
 *     tags: [Utils]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Reverse geocoded location data
 *       400:
 *         description: Invalid lat/lng parameters
 */
router.get('/reverse-geocode', getReverseGeocode);

export default router;
