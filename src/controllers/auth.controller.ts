import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { COOKIE_NAME, COOKIE_OPTIONS, JWTPayload, signToken } from '../config/auth';

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

    let dbUserId: string | null = null;
    let dbPassword: string | null = null;
    let role: string | null = null;
    let isActive = false;
    let displayName: string | null = null;

    const internalUser = await prisma.user.findUnique({
      where: { email: emailNormalized },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
        displayName: true,
      },
    });

    if (internalUser) {
      dbUserId = internalUser.id;
      dbPassword = internalUser.password;
      role = internalUser.role;
      isActive = internalUser.isActive;
      displayName = internalUser.displayName;
    }

    if (!dbUserId) {
      const contractor = await prisma.contractor.findUnique({
        where: { email: emailNormalized },
        select: {
          id: true,
          email: true,
          password: true,
          isActive: true,
          companyName: true,
        },
      });
      if (contractor) {
        dbUserId = contractor.id;
        dbPassword = contractor.password;
        role = 'CONTRACTOR';
        isActive = contractor.isActive;
        displayName = contractor.companyName;
      }
    }

    if (!dbUserId) {
      const regulator = await prisma.regulator.findUnique({
        where: { email: emailNormalized },
        select: {
          id: true,
          email: true,
          password: true,
          isActive: true,
          displayName: true,
        },
      });
      if (regulator) {
        dbUserId = regulator.id;
        dbPassword = regulator.password;
        role = 'REGULATOR';
        isActive = regulator.isActive;
        displayName = regulator.displayName;
      }
    }

    const hashToCompare = dbPassword || DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!dbUserId || !passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (!isActive) {
      return res.status(403).json({
        error: 'Account is deactivated. Contact your administrator.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    const isExternal = role === 'CONTRACTOR' || role === 'REGULATOR';
    const jwtPayload: JWTPayload = {
      userId: dbUserId,
      email: emailNormalized,
      role: role!,
      isExternal,
      dbUserId,
    };

    const token = signToken(jwtPayload);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    return res.json({
      data: {
        user: {
          id: dbUserId,
          email: emailNormalized,
          role,
          displayName,
          isExternal,
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
    const { userId, role } = req.user!;

    const user = await prisma.user.findUnique({
      where: { id: userId! },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        isActive: true,
      },
    });
    if (user) {
      return res.json({
        data: {
          ...user,
          isExternal: user.role === 'CONTRACTOR' || user.role === 'REGULATOR',
        },
      });
    }

    if (role === 'CONTRACTOR') {
      const contractor = await prisma.contractor.findUnique({
        where: { id: userId! },
        select: {
          id: true,
          email: true,
          companyName: true,
          contractorId: true,
          isActive: true,
        },
      });
      return res.json({
        data: {
          ...contractor,
          role: 'CONTRACTOR',
          isExternal: true,
          displayName: contractor?.companyName,
        },
      });
    }

    if (role === 'REGULATOR') {
      const regulator = await prisma.regulator.findUnique({
        where: { id: userId! },
        select: {
          id: true,
          email: true,
          displayName: true,
          organisation: true,
          isActive: true,
        },
      });
      return res.json({
        data: {
          ...regulator,
          role: 'REGULATOR',
          isExternal: true,
        },
      });
    }

    return res.status(400).json({ error: 'Unknown role' });
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
