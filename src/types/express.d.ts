import { UserRole } from '@prisma/client';
import { ExternalUserRole } from './roles';

declare global {
  namespace Express {
    interface Request {
      sanitizedBody?: Record<string, unknown>;
    }

    interface Request {
      user?: {
        oid?: string;
        userId?: string;
        email: string;
        displayName?: string;
        role: UserRole | ExternalUserRole;
        isExternal: boolean;
        dbUserId: string;
      };
    }
  }
}

export {};
