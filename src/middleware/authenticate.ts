import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/auth';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    req.user = {
      oid: payload.userId,
      email: payload.email,
      displayName: payload.email,
      role: payload.role as any,
      isExternal: payload.isExternal,
      dbUserId: payload.userId,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};
