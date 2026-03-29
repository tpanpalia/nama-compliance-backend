import { Request, Response, NextFunction } from 'express'
import { notificationService } from '../services/notification.service'
import { qs, qsDefault } from '../utils/query'

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.list(req.user!.userId, {
      unread: qs(req.query.unread),
      page:   parseInt(qsDefault(req.query.page,  '1'),  10),
      limit:  parseInt(qsDefault(req.query.limit, '20'), 10),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.getById(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const markRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.markRead(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const markAllRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.markAllRead(req.user!.userId)
    res.json(result)
  } catch (err) { next(err) }
}
