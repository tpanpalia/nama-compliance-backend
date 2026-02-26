import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { signToken } from '../config/auth';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const token = signToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        isExternal: false,
      });
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          isExternal: false,
        },
      });
    }

    const contractor = await prisma.contractor.findUnique({ where: { email } });

    if (contractor) {
      if (!contractor.isActive) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }
      const valid = await bcrypt.compare(password, contractor.password);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const token = signToken({
        userId: contractor.id,
        email: contractor.email,
        role: 'CONTRACTOR',
        isExternal: true,
      });
      return res.json({
        token,
        user: {
          id: contractor.id,
          email: contractor.email,
          displayName: contractor.companyName,
          role: 'CONTRACTOR',
          contractorId: contractor.contractorId,
          isExternal: true,
        },
      });
    }

    return res.status(401).json({ error: 'Invalid email or password' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    if (!req.user.isExternal) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.dbUserId },
        select: { id: true, email: true, displayName: true, role: true, isActive: true, createdAt: true },
      });
      return res.json({ data: user });
    } else {
      const contractor = await prisma.contractor.findUnique({
        where: { id: req.user.dbUserId },
        select: { id: true, email: true, companyName: true, contractorId: true, isActive: true, createdAt: true },
      });
      return res.json({ data: { ...contractor, role: 'CONTRACTOR' } });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
