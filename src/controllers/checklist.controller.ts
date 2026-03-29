import { Request, Response, NextFunction } from 'express'
import { checklistService } from '../services/admin/checklist.service'
import { qs } from '../utils/query'

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await checklistService.list({
      active:   qs(req.query.active),
      category: qs(req.query.category),
    })
    res.json(result)
  } catch (err) { next(err) }
}
