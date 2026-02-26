import { NextFunction, Request, Response } from 'express';
import * as ScoringConfigService from '../services/scoring.config.service';
import { UpdateScoringConfigSchema } from '../services/scoring.config.service';

export const getConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ScoringConfigService.getScoringConfig();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const updateConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateScoringConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await ScoringConfigService.updateScoringConfig(parsed.data.weights, req.user!.dbUserId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
