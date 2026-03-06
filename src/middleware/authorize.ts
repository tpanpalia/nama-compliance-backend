import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { ExternalUserRole } from '../types/roles';
import { sendError } from '../utils/errorResponse';

type AllowedRole = UserRole | ExternalUserRole;

export const authorize = (...roles: AllowedRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, req, 401, 'UNAUTHORIZED', 'Unauthorized');
      return;
    }
    if (!roles.includes(req.user.role as AllowedRole)) {
      sendError(res, req, 403, 'FORBIDDEN', `This action requires one of: ${roles.join(', ')}`);
      return;
    }
    next();
  };
};
