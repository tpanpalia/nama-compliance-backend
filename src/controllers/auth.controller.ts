import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { COOKIE_NAME, COOKIE_OPTIONS, JWTPayload, signToken } from '../config/auth';
import { AppError } from '../utils/AppError';

const BCRYPT_ROUNDS = 10;
const DUMMY_HASH = bcrypt.hashSync('dummy_password_for_timing', BCRYPT_ROUNDS);

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS',
      });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Invalid input format',
        code: 'INVALID_INPUT',
      });
    }

    const emailNormalized = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
    }

    const identity = await prisma.identity.findUnique({
      where: { email: emailNormalized },
      include: {
        user: true,
        contractor: true,
      },
    });

    const hashToCompare = identity?.password || DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!identity || !passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const profile = identity.user || identity.contractor;
    const profileIsActive = profile?.isActive ?? false;

    if (!identity.isActive || !profileIsActive) {
      return res.status(403).json({
        error: 'Account is deactivated. Contact your administrator.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    const displayName = identity.user?.displayName || identity.contractor?.companyName || identity.email;
    const jwtPayload: JWTPayload = {
      identityId: identity.id,
      email: emailNormalized,
      role: identity.role,
      displayName,
      dbUserId: identity.userId || undefined,
      contractorId: identity.contractorId || undefined,
    };

    const token = signToken(jwtPayload);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    return res.json({
      data: {
        user: {
          id: identity.contractorId || identity.userId || identity.id,
          email: emailNormalized,
          role: identity.role,
          displayName,
          isExternal: identity.role === 'CONTRACTOR',
        },
        token,
      },
      message: 'Login successful',
    });
  } catch (err) {
    return next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identityId = req.user?.identityId;
    if (!identityId) throw new AppError('Authentication required', 401, 'NO_TOKEN');

    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
      include: {
        user: true,
        contractor: true,
      },
    });

    if (!identity) {
      throw new AppError('Identity not found', 404, 'NOT_FOUND');
    }

    if (identity.contractor) {
      return res.json({
        data: {
          id: identity.contractor.id,
          email: identity.email,
          companyName: identity.contractor.companyName,
          contractorId: identity.contractor.contractorId,
          isActive: identity.contractor.isActive && identity.isActive,
          role: identity.role,
          isExternal: true,
          displayName: identity.contractor.companyName,
        },
      });
    }

    if (identity.user) {
      return res.json({
        data: {
          id: identity.user.id,
          email: identity.email,
          role: identity.user.role,
          displayName: identity.user.displayName,
          organisation: identity.user.organisation,
          department: identity.user.department,
          isActive: identity.user.isActive && identity.isActive,
          isExternal: false,
        },
      });
    }

    throw new AppError('Identity profile is missing', 400, 'INVALID_IDENTITY');
  } catch (err) {
    return next(err);
  }
};

export const logout = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    });
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    return next(err);
  }
};
