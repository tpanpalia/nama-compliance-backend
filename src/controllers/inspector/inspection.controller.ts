import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { RatingValue } from '@prisma/client'
import { inspectorInspectionService } from '../../services/inspector/inspection.service'
import { qs, qsDefault } from '../../utils/query'

const saveResponsesSchema = z.object({
  responses: z.array(z.object({
    checklistItemId:   z.string(),
    rating:            z.nativeEnum(RatingValue).nullable().optional(),
    inspectorComments: z.string().nullable().optional(),
  })),
})

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectorInspectionService.list(req.user!.userId, {
      status: qs(req.query.status),
      page:   parseInt(qsDefault(req.query.page,  '1'),  10),
      limit:  parseInt(qsDefault(req.query.limit, '20'), 10),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectorInspectionService.getById(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const start = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectorInspectionService.start(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const saveResponses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { responses } = saveResponsesSchema.parse(req.body)
    const result = await inspectorInspectionService.saveResponses(req.user!.userId, req.params.id, responses)
    res.json(result)
  } catch (err) { next(err) }
}

export const submit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectorInspectionService.submit(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}
