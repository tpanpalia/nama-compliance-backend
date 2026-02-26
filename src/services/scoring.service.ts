import { ComplianceBand, RatingValue } from '@prisma/client';
import { COMPLIANCE_BANDS, RATING_POINTS } from '../types';

export interface ScoringInput {
  sectionName: string;
  sectionWeight?: number;
  isRequired: boolean;
  rating: RatingValue | null;
}

export interface ComplianceScoreResult {
  overallScore: number;
  complianceBand: ComplianceBand;
  categoryScores: Record<string, number>;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

const getBand = (score: number): ComplianceBand => {
  if (score >= COMPLIANCE_BANDS.EXCELLENT.min) return ComplianceBand.EXCELLENT;
  if (score >= COMPLIANCE_BANDS.GOOD.min) return ComplianceBand.GOOD;
  if (score >= COMPLIANCE_BANDS.FAIR.min) return ComplianceBand.FAIR;
  return ComplianceBand.POOR;
};

const ratingToPoints = (rating: RatingValue): number => {
  if (rating === RatingValue.COMPLIANT) return RATING_POINTS.COMPLIANT;
  if (rating === RatingValue.PARTIAL) return RATING_POINTS.PARTIAL;
  return RATING_POINTS.NON_COMPLIANT;
};

type ScoringArgs =
  | ScoringInput[]
  | {
      responses: ScoringInput[];
      weights?: Record<string, number>;
    };

export const calculateComplianceScore = (
  input: ScoringArgs,
  fallbackWeights?: Record<string, number>
): ComplianceScoreResult => {
  const responses = Array.isArray(input) ? input : input.responses;
  const weights = Array.isArray(input) ? fallbackWeights : input.weights;
  const grouped = new Map<string, { weight: number; scores: number[] }>();

  for (const entry of responses) {
    if (!grouped.has(entry.sectionName)) {
      grouped.set(entry.sectionName, {
        weight: weights?.[entry.sectionName] ?? entry.sectionWeight ?? 0,
        scores: [],
      });
    }

    if (entry.rating === null) {
      if (entry.isRequired) {
        throw new Error(`Checklist incomplete. Required item in ${entry.sectionName} is not rated.`);
      }
      continue;
    }

    grouped.get(entry.sectionName)?.scores.push(ratingToPoints(entry.rating));
  }

  const categoryScores: Record<string, number> = {};
  let overall = 0;

  for (const [sectionName, section] of grouped.entries()) {
    const sectionScore = section.scores.length
      ? section.scores.reduce((a, b) => a + b, 0) / section.scores.length
      : 0;
    categoryScores[sectionName] = round2(sectionScore);
    overall += sectionScore * section.weight;
  }

  const overallScore = round2(overall);
  return {
    overallScore,
    complianceBand: getBand(overallScore),
    categoryScores,
  };
};
