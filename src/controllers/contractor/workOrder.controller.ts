import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { contractorWorkOrderService } from '../../services/contractor/workOrder.service'
import { qs, qsDefault } from '../../utils/query'

const evidenceSchema = z.object({
  checklistItemId: z.string(),
  fileId:          z.string().uuid(),
  comment:         z.string().optional(),
  gpsLat:          z.number().optional(),
  gpsLng:          z.number().optional(),
  gpsAccuracy:     z.number().optional(),
  capturedAt:      z.string().datetime().optional(),
})

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await contractorWorkOrderService.list(req.user!.userId, {
      status: qs(req.query.status),
      page:   parseInt(qsDefault(req.query.page,  '1'),  10),
      limit:  parseInt(qsDefault(req.query.limit, '20'), 10),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await contractorWorkOrderService.getById(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const start = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await contractorWorkOrderService.start(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const submit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await contractorWorkOrderService.submit(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const addEvidence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data   = evidenceSchema.parse(req.body)
    const result = await contractorWorkOrderService.addEvidence(req.user!.userId, req.params.id, data)
    res.status(201).json(result)
  } catch (err) { next(err) }
}
