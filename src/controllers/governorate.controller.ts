import { Request, Response, NextFunction } from 'express'
import { governorateRepository } from '../repositories/governorate.repository'

export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const govs = await governorateRepository.findAll()
    res.json(govs)
  } catch (err) { next(err) }
}
