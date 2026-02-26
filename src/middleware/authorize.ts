import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { ExternalUserRole } from '../types/roles';

type AllowedRole = UserRole | ExternalUserRole;

export const authorize = (...roles: AllowedRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role as AllowedRole)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of: ${roles.join(', ')}`,
      });
      return;
    }
    next();
  };
};
