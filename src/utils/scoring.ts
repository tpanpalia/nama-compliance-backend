import { RatingValue, ComplianceRating, ChecklistCategory } from '@prisma/client'

const RATING_WEIGHT: Record<RatingValue, number> = {
  COMPLIANT:     1.0,
  PARTIAL:       0.5,
  NON_COMPLIANT: 0.0,
}

export interface ResponseInput {
  checklistItemId: string
  category: ChecklistCategory
  itemWeight: number
  rating: RatingValue
}

export interface CategoryScores {
  hse:       number | null
  technical: number | null
  process:   number | null
  closure:   number | null
}

export interface ScoreResult {
  categoryScores: CategoryScores
  finalScore: number
  complianceRating: ComplianceRating
}

/**
 * Calculate category scores and final weighted score.
 *
 * Category score = Σ(rating_value × item_weight) / Σ(item_weights) × 100
 * Final score    = Σ(category_score × category_percent) / 100
 */
export function calculateScores(
  responses: ResponseInput[],
  weights: { hsePercent: number; technicalPercent: number; processPercent: number; closurePercent: number },
): ScoreResult {
  const buckets: Record<ChecklistCategory, { weightedSum: number; totalWeight: number }> = {
    HSE:       { weightedSum: 0, totalWeight: 0 },
    TECHNICAL: { weightedSum: 0, totalWeight: 0 },
    PROCESS:   { weightedSum: 0, totalWeight: 0 },
    CLOSURE:   { weightedSum: 0, totalWeight: 0 },
  }

  for (const r of responses) {
    buckets[r.category].weightedSum  += RATING_WEIGHT[r.rating] * r.itemWeight
    buckets[r.category].totalWeight  += r.itemWeight
  }

  function catScore(cat: ChecklistCategory): number | null {
    const b = buckets[cat]
    if (b.totalWeight === 0) return null
    return Math.round((b.weightedSum / b.totalWeight) * 100 * 10) / 10
  }

  const hse       = catScore('HSE')
  const technical = catScore('TECHNICAL')
  const process   = catScore('PROCESS')
  const closure   = catScore('CLOSURE')

  const finalScore = Math.round(
    (
      (hse       ?? 0) * weights.hsePercent       +
      (technical ?? 0) * weights.technicalPercent +
      (process   ?? 0) * weights.processPercent   +
      (closure   ?? 0) * weights.closurePercent
    ) / 100 * 10,
  ) / 10

  const complianceRating: ComplianceRating =
    finalScore >= 90 ? 'EXCELLENT' :
    finalScore >= 80 ? 'GOOD'      :
    finalScore >= 70 ? 'FAIR'      :
                       'POOR'

  return { categoryScores: { hse, technical, process, closure }, finalScore, complianceRating }
}
