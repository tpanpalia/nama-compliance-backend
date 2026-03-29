import { AppError } from '../../middleware/errorHandler'
import { scoringRepository } from '../../repositories/scoring.repository'
import { auditLogRepository } from '../../repositories/auditLog.repository'

export const scoringService = {
  list: async () => scoringRepository.findAll(),

  create: async (performedBy: string, data: {
    hsePercent: number
    technicalPercent: number
    processPercent: number
    closurePercent: number
    effectiveFrom: string
  }) => {
    if (data.hsePercent + data.technicalPercent + data.processPercent + data.closurePercent !== 100) {
      throw new AppError(400, 'Category percentages must sum to 100')
    }

    const effectiveFrom = new Date(data.effectiveFrom)
    const effectiveTo   = new Date(effectiveFrom.getTime() - 86400000)

    await scoringRepository.closeActive(effectiveTo)

    const weights = await scoringRepository.create({
      hsePercent:       data.hsePercent,
      technicalPercent: data.technicalPercent,
      processPercent:   data.processPercent,
      closurePercent:   data.closurePercent,
      effectiveFrom,
      effectiveTo:      null,
      createdBy:        performedBy,
    })

    await auditLogRepository.create({
      performedBy,
      entityType: 'SCORING_WEIGHTS',
      entityId:   weights.id,
      action:     'CREATED',
      metadata:   data,
    })

    return weights
  },
}
