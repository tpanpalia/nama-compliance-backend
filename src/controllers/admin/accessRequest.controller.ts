import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { accessRequestService } from '../../services/admin/accessRequest.service'
import { qs, qsDefault } from '../../utils/query'

const rejectSchema = z.object({ reason: z.string().min(1) })

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await accessRequestService.list({
      status: qs(req.query.status),
      role:   qs(req.query.role),
      page:   parseInt(qsDefault(req.query.page,  '1'),  10),
      limit:  parseInt(qsDefault(req.query.limit, '20'), 10),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await accessRequestService.getById(req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const approve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await accessRequestService.approve(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const reject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = rejectSchema.parse(req.body)
    const result = await accessRequestService.reject(req.user!.userId, req.params.id, reason)
    res.json(result)
  } catch (err) { next(err) }
}
