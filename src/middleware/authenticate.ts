import { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME, verifyToken } from '../config/auth';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  if (req.cookies?.[COOKIE_NAME]) {
    token = req.cookies[COOKIE_NAME];
  }

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_TOKEN',
    });
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as any,
      isExternal: payload.isExternal,
      dbUserId: payload.dbUserId,
    };
    return next();
  } catch (_err) {
    return res.status(401).json({
      error: 'Session expired. Please log in again.',
      code: 'INVALID_TOKEN',
    });
  }
}
