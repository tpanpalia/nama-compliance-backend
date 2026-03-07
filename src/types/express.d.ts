import { IdentityRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      sanitizedBody?: Record<string, unknown>;
    }

    interface Request {
      user?: {
        oid?: string;
        identityId?: string;
        email: string;
        displayName?: string;
        role: IdentityRole;
        dbUserId?: string;
        contractorId?: string;
      };
    }
  }
}

export {};
