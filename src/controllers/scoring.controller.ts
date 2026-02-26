import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';

export const getScoringConfigController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.scoringConfig.findUnique({ where: { name: 'default' } });
    res.json({ data, message: 'Scoring config fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateScoringConfigController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const weights = req.body.weights as Record<string, number>;
    const sum = Object.values(weights).reduce((acc, value) => acc + value, 0);
    if (Math.abs(sum - 1) > 0.001) {
      res.status(400).json({ error: 'Weights must sum to 1.0 (±0.001)' });
      return;
    }

    const sectionNames = await prisma.checklistSection.findMany({ select: { name: true } });
    const allowed = new Set(sectionNames.map((s) => s.name));
    for (const key of Object.keys(weights)) {
      if (!allowed.has(key)) {
        res.status(400).json({ error: `Unknown section name: ${key}` });
        return;
      }
    }

    const data = await prisma.scoringConfig.upsert({
      where: { name: 'default' },
      update: { weights, updatedBy: req.user?.dbUserId },
      create: { name: 'default', weights, updatedBy: req.user?.dbUserId },
    });

    res.json({ data, message: 'Scoring config updated successfully' });
  } catch (error) {
    next(error);
  }
};
