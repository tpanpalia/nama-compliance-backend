import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { regulatorDashboardService } from '../../services/regulator/dashboard.service'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(new Date().getFullYear() + '-01-01'),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(new Date().toISOString().slice(0, 10)),
})

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = querySchema.parse(req.query)
    const result = await regulatorDashboardService.get(from, to)
    res.json(result)
  } catch (err) { next(err) }
}
