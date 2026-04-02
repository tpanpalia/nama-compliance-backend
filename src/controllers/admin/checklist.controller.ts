import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { ChecklistCategory } from '@prisma/client'
import { checklistService } from '../../services/admin/checklist.service'
import { qs } from '../../utils/query'

const createSchema = z.object({
  id:        z.string().regex(/^[A-Z]+-\d{3}$/, 'ID must match pattern like HSE-001'),
  question:  z.string().min(5),
  category:  z.nativeEnum(ChecklistCategory),
  weight:    z.number().int().min(1).max(100),
  order:     z.number().int().min(1),
  mandatory: z.boolean().optional().default(true),
  isActive:  z.boolean().optional().default(true),
})

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await checklistService.list({
      active:   qs(req.query.active),
      category: qs(req.query.category),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data   = createSchema.parse(req.body)
    const result = await checklistService.create(req.user!.userId, data)
    res.json(result)
  } catch (err) { next(err) }
}

export const deactivate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await checklistService.deactivate(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}
