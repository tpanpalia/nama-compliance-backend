import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { adminDashboardService } from '../../services/admin/dashboard.service'

const querySchema = z.object({
  year:  z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()),
  month: z.coerce.number().int().min(0).max(12).default(0),
})

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, month } = querySchema.parse(req.query)
    const result = await adminDashboardService.get(year, month)
    res.json(result)
  } catch (err) { next(err) }
}
