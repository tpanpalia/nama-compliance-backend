import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { UserStatus } from '@prisma/client'
import { adminUserService } from '../../services/admin/user.service'
import { qs, qsDefault } from '../../utils/query'

const createSchema = z.object({
  email:      z.string().email(),
  role:       z.enum(['INSPECTOR', 'ADMIN']),
  employeeId: z.string().min(1),
  fullName:   z.string().min(2),
  phone:      z.string().min(1),
})

const statusSchema = z.object({ status: z.nativeEnum(UserStatus) })

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminUserService.list({
      role:   qs(req.query.role),
      status: qs(req.query.status),
      search: qs(req.query.search),
      page:   parseInt(qsDefault(req.query.page,  '1'),  10),
      limit:  parseInt(qsDefault(req.query.limit, '20'), 10),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminUserService.getById(req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data   = createSchema.parse(req.body)
    const result = await adminUserService.create(req.user!.userId, data)
    res.status(201).json(result)
  } catch (err) { next(err) }
}

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = statusSchema.parse(req.body)
    const result = await adminUserService.updateStatus(req.user!.userId, req.params.id, status, req.user!.userId)
    res.json(result)
  } catch (err) { next(err) }
}
