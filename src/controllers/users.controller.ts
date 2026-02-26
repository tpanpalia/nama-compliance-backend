import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';

export const listUsers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ data, message: 'Users fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    res.json({ data, message: 'User fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: req.body.isActive } });
    res.json({ data, message: 'User status updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const getMyUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.dbUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const data = await prisma.user.findUniqueOrThrow({ where: { id: req.user.dbUserId } });
    res.json({ data, message: 'My profile fetched successfully' });
  } catch (error) {
    next(error);
  }
};
