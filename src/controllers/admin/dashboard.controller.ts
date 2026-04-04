import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { adminDashboardService } from '../../services/admin/dashboard.service'
import { dashboardRepository } from '../../repositories/dashboard.repository'

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

export const getYearRange = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dashboardRepository.getYearRange()
    const { min_year, max_year } = result[0]
    const years: number[] = []
    for (let y = min_year; y <= Math.max(max_year, new Date().getFullYear()); y++) years.push(y)
    res.json({ years })
  } catch (err) { next(err) }
}
