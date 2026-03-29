import { Request, Response, NextFunction } from 'express'
import { inspectorWorkOrderService } from '../../services/inspector/workOrder.service'
import { qs, qsDefault } from '../../utils/query'

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectorWorkOrderService.list(req.user!.userId, {
      view:  qs(req.query.view) ?? 'pool',
      page:  parseInt(qsDefault(req.query.page,  '1'),  10),
      limit: parseInt(qsDefault(req.query.limit, '20'), 10),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectorWorkOrderService.getById(req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const claim = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectorWorkOrderService.claim(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}
