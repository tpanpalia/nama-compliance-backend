import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { adminContractorService } from '../../services/admin/contractor.service'
import { dashboardRepository } from '../../repositories/dashboard.repository'
import { qs, qsDefault } from '../../utils/query'

const createSchema = z.object({
  companyName:        z.string().min(1),
  contactName:        z.string().min(1),
  email:              z.string().email(),
  phone:              z.string().min(1),
  crNumber:           z.string().min(1),
  address:            z.string().optional(),
  regionsOfOperation: z.array(z.string()).optional(),
})

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']),
  reason: z.string().optional(),
})

const perfQuerySchema = z.object({
  year:  z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()),
  month: z.coerce.number().int().min(0).max(12).default(0),
})

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSchema.parse(req.body)
    const result = await adminContractorService.create(req.user!.userId, data)
    res.status(201).json(result)
  } catch (err) { next(err) }
}

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminContractorService.list({
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
    const result = await adminContractorService.getById(req.params.cr)
    res.json(result)
  } catch (err) { next(err) }
}

export const getPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, month } = perfQuerySchema.parse(req.query)
    const result = await adminContractorService.getPerformance(req.params.cr, year, month)
    res.json(result)
  } catch (err) { next(err) }
}

export const getSummary = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dashboardRepository.getContractorsSummary()
    res.json((result[0] as Record<string, unknown>)['get_contractors_summary'])
  } catch (err) { next(err) }
}

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reason } = statusSchema.parse(req.body)
    const result = await adminContractorService.updateStatus(req.user!.userId, req.params.cr, status, reason)
    res.json(result)
  } catch (err) { next(err) }
}
