import { NextFunction, Request, Response } from 'express';
import jwt, { JwtHeader, JwtPayload, VerifyErrors } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { AUTH_CONFIG, azureAdJwksClient, azureB2cJwksClient } from '../config/auth';
import { prisma } from '../config/database';
import logger from '../config/logger';
import { EXTERNAL_USER_ROLES, ExternalUserRole } from '../types/roles';

const getSigningKey = async (kid: string, useB2c: boolean): Promise<string> => {
  const client = useB2c ? azureB2cJwksClient : azureAdJwksClient;
  const key = await client.getSigningKey(kid);
  return key.getPublicKey();
};

const verifyToken = async (
  token: string,
  useB2c: boolean
): Promise<{ payload: JwtPayload; isExternal: boolean }> => {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new Error('Invalid token');
  }

  const kid = (decoded.header as JwtHeader).kid;
  if (!kid) {
    throw new Error('Token key id is missing');
  }

  const publicKey = await getSigningKey(kid, useB2c);
  const config = useB2c ? AUTH_CONFIG.azureB2c : AUTH_CONFIG.azureAd;

  const payload = await new Promise<JwtPayload>((resolve, reject) => {
    jwt.verify(
      token,
      publicKey,
      {
        algorithms: ['RS256'],
        issuer: config.issuer,
        audience: config.audience,
      },
      (err: VerifyErrors | null, verified: string | JwtPayload | undefined) => {
        if (err || !verified || typeof verified === 'string') {
          reject(err || new Error('Token verification failed'));
          return;
        }
        resolve(verified);
      }
    );
  });

  return { payload, isExternal: useB2c };
};

const normalizeRole = (roleClaim: unknown): UserRole | ExternalUserRole | null => {
  const role = Array.isArray(roleClaim) ? roleClaim[0] : roleClaim;
  if (
    role === UserRole.ADMIN ||
    role === UserRole.INSPECTOR ||
    role === EXTERNAL_USER_ROLES.CONTRACTOR ||
    role === EXTERNAL_USER_ROLES.REGULATOR
  ) {
    return role;
  }
  return null;
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.slice(7);

    let verified: { payload: JwtPayload; isExternal: boolean };
    try {
      verified = await verifyToken(token, false);
    } catch {
      verified = await verifyToken(token, true);
    }

    const payload = verified.payload;
    const role = normalizeRole(payload.role ?? payload.roles);
    const oid = (payload.oid || payload.sub) as string | undefined;

    if (!oid || !role) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const email = (payload.email || payload.preferred_username || '') as string;
    const displayName = (payload.name || payload.given_name || email || 'Unknown User') as string;

    req.user = {
      oid,
      email,
      displayName,
      role,
      isExternal: verified.isExternal,
    };

    if (role === UserRole.ADMIN || role === UserRole.INSPECTOR) {
      const dbUser = await prisma.user.findUnique({ where: { azureAdOid: oid } });
      if (dbUser) {
        req.user.dbUserId = dbUser.id;
      }
    }

    if (role === EXTERNAL_USER_ROLES.CONTRACTOR) {
      const contractor = await prisma.contractor.findUnique({ where: { b2cOid: oid } });
      if (contractor) {
        req.user.dbUserId = contractor.id;
      }
    }

    next();
  } catch (error) {
    logger.warn('Authentication failed');
    res.status(401).json({ error: 'Unauthorized' });
  }
};
