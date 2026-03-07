import { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME, verifyToken } from '../config/auth';
import { sendError } from '../utils/errorResponse';

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
    return sendError(res, req, 401, 'NO_TOKEN', 'Authentication required');
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      identityId: payload.identityId,
      email: payload.email,
      role: payload.role as any,
      displayName: payload.displayName,
      dbUserId: payload.dbUserId,
      contractorId: payload.contractorId,
    };
    return next();
  } catch (_err) {
    return sendError(res, req, 401, 'INVALID_TOKEN', 'Session expired. Please log in again.');
  }
}
