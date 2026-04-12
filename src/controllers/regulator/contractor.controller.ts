import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { regulatorContractorService } from '../../services/regulator/contractor.service'
import { qs, qsDefault } from '../../utils/query'

const perfQuerySchema = z.object({
  year:  z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()),
  month: z.coerce.number().int().min(0).max(12).default(0),
})

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await regulatorContractorService.list({
      status: qs(req.query.status),
      search: qs(req.query.search),
      page:   parseInt(qsDefault(req.query.page,  '1'),  10),
      limit:  parseInt(qsDefault(req.query.limit, '20'), 10),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await regulatorContractorService.getById(req.params.cr)
    res.json(result)
  } catch (err) { next(err) }
}

export const getSummary = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await regulatorContractorService.getSummary()
    res.json(result)
  } catch (err) { next(err) }
}

export const getPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, month } = perfQuerySchema.parse(req.query)
    const result = await regulatorContractorService.getPerformance(req.params.cr, year, month)
    res.json(result)
  } catch (err) { next(err) }
}
