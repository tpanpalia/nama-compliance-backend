import jwt from 'jsonwebtoken';
import { CookieOptions } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

export const COOKIE_NAME = 'nama_auth_token';

export const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};

export interface JWTPayload {
  identityId: string;
  email: string;
  role: string;
  displayName: string;
  dbUserId?: string;
  contractorId?: string;
}

export const signToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as any);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};
