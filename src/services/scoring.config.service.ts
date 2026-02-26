import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { DEFAULT_SCORING_WEIGHTS } from '../types';

export const UpdateScoringConfigSchema = z.object({
  weights: z.record(z.string(), z.number().min(0).max(1)),
});

export async function getScoringConfig() {
  const config = await prisma.scoringConfig.findUnique({ where: { name: 'default' } });
  if (!config) {
    return { name: 'default', weights: DEFAULT_SCORING_WEIGHTS, updatedAt: null };
  }
  return config;
}

export async function updateScoringConfig(weights: Record<string, number>, updatedBy: string) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum < 0.999 || sum > 1.001) {
    throw new AppError(`Weights must sum to 1.0 — received ${Math.round(sum * 1000) / 1000}`, 400);
  }
  return prisma.scoringConfig.upsert({
    where: { name: 'default' },
    update: { weights, updatedBy },
    create: { name: 'default', weights, updatedBy },
  });
}
