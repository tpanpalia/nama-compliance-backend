import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { inspectorEvidenceService } from '../../services/inspector/evidence.service'

const createSchema = z.object({
  inspectionId:    z.string().uuid(),
  workOrderId:     z.string(),
  checklistItemId: z.string(),
  fileId:          z.string().uuid(),
  comment:         z.string().optional(),
  gpsLat:          z.number().optional(),
  gpsLng:          z.number().optional(),
  gpsAccuracy:     z.number().optional(),
  capturedAt:      z.string().datetime().optional(),
})

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data   = createSchema.parse(req.body)
    const result = await inspectorEvidenceService.create(req.user!.userId, data)
    res.status(201).json(result)
  } catch (err) { next(err) }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectorEvidenceService.delete(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}
