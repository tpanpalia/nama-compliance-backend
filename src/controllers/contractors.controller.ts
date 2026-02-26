import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { getContractorPerformance } from '../services/contractors.service';

export const listContractors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, isActive, page = '1', limit = '20' } = req.query as Record<string, string>;
    const where = {
      ...(typeof isActive === 'string' ? { isActive: isActive === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' as const } },
              { contractorId: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.contractor.count({ where }),
      prisma.contractor.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      data: items,
      message: 'Contractors fetched successfully',
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (error) {
    next(error);
  }
};

export const getContractorById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.contractor.findUniqueOrThrow({ where: { id: req.params.id } });
    res.json({ data, message: 'Contractor fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const contractorPerformance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await getContractorPerformance(req.params.id);
    res.json({ data, message: 'Contractor performance fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateContractorStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.contractor.update({
      where: { id: req.params.id },
      data: { isActive: req.body.isActive },
    });
    res.json({ data, message: 'Contractor status updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const getMyContractorProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.dbUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const [profile, stats] = await Promise.all([
      prisma.contractor.findUniqueOrThrow({ where: { id: req.user.dbUserId } }),
      getContractorPerformance(req.user.dbUserId),
    ]);
    res.json({ data: { profile, stats }, message: 'Contractor profile fetched successfully' });
  } catch (error) {
    next(error);
  }
};
