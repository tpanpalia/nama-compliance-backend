import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
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
  message: {
    error: 'Too many requests. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});
