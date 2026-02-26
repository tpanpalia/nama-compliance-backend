import { UserRole } from '@prisma/client';
import { ExternalUserRole } from './roles';

declare global {
  namespace Express {
    interface Request {
      user?: {
        oid: string;
        email: string;
        displayName: string;
        role: UserRole | ExternalUserRole;
        isExternal: boolean;
        dbUserId?: string;
      };
    }
  }
}

export {};
