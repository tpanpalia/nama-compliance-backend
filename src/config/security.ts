import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { buildErrorResponse } from '../utils/errorResponse';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).json(
      buildErrorResponse(
        req,
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many login attempts. Please try again in 15 minutes.'
      )
    );
  },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    return `${req.ip}_${email.toLowerCase()}`;
  },
});

export const loginSlowDown: ReturnType<typeof slowDown> = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 5,
  delayMs: (hits) => hits * 500,
  maxDelayMs: 5000,
  skipSuccessfulRequests: true,
});

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(buildErrorResponse(req, 429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please slow down.'));
  },
});
