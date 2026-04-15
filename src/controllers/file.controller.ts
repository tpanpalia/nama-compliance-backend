import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { FileCategory } from '@prisma/client'
import { fileService } from '../services/file.service'

const presignSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  category: z.nativeEnum(FileCategory),
  fileSize: z.number().int().positive().optional(),
})

export const presign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data   = presignSchema.parse(req.body)
    const result = await fileService.presign(req.user!.userId, data)
    res.status(201).json(result)
  } catch (err) { next(err) }
}

export const confirm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fileService.confirm(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const getUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fileService.getUrl(req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}
