import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { scoringService } from '../../services/admin/scoring.service'

const createSchema = z.object({
  hsePercent:       z.number().int().min(1).max(100),
  technicalPercent: z.number().int().min(1).max(100),
  processPercent:   z.number().int().min(1).max(100),
  closurePercent:   z.number().int().min(1).max(100),
  effectiveFrom:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(
  (data) => data.hsePercent + data.technicalPercent + data.processPercent + data.closurePercent === 100,
  { message: 'Scoring weights must sum to exactly 100' },
)

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await scoringService.list()
    res.json(result)
  } catch (err) { next(err) }
}

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data   = createSchema.parse(req.body)
    const result = await scoringService.create(req.user!.userId, data)
    res.status(201).json(result)
  } catch (err) { next(err) }
}
