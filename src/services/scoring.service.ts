import { ComplianceBand } from '@prisma/client';
import { COMPLIANCE_BANDS } from '../types';

export interface ScoringInput {
  responses: Array<{
    rating: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | null;
    isRequired: boolean;
    sectionName: string;
    sectionWeight: number;
  }>;
}

export interface ComplianceScoreResult {
  overallScore: number;
  complianceBand: ComplianceBand;
  categoryScores: Record<string, number>;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

const getBand = (score: number): ComplianceBand => {
  if (score >= COMPLIANCE_BANDS.EXCELLENT.min) return ComplianceBand.EXCELLENT;
  if (score >= COMPLIANCE_BANDS.GOOD.min) return ComplianceBand.GOOD;
  if (score >= COMPLIANCE_BANDS.FAIR.min) return ComplianceBand.FAIR;
  return ComplianceBand.POOR;
};

export const calculateComplianceScore = (input: ScoringInput): ComplianceScoreResult => {
  const POINTS: Record<string, number> = {
    COMPLIANT: 100,
    PARTIAL: 50,
    NON_COMPLIANT: 0,
  };

  const sections: Record<string, { weight: number; scores: number[] }> = {};

  for (const r of input.responses) {
    if (!sections[r.sectionName]) {
      sections[r.sectionName] = { weight: r.sectionWeight, scores: [] };
    }
    if (r.isRequired && r.rating === null) {
      throw new Error(`Required item in section "${r.sectionName}" has no rating`);
    }
    if (r.rating !== null) {
      sections[r.sectionName].scores.push(POINTS[r.rating] || 0);
    }
  }

  let overallScore = 0;
  const categoryScores: Record<string, number> = {};

  for (const [name, section] of Object.entries(sections)) {
    const avg = section.scores.length
      ? section.scores.reduce((a, b) => a + b, 0) / section.scores.length
      : 0;
    categoryScores[name] = round1(avg);
    overallScore += avg * section.weight;
  }

  overallScore = round1(overallScore);

  return {
    overallScore,
    complianceBand: getBand(overallScore),
    categoryScores,
  };
};
