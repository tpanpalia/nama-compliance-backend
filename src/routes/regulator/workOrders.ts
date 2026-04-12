import { Router, Request, Response, NextFunction } from 'express'
import { workOrderRepository } from '../../repositories/workOrder.repository'
import { AppError } from '../../middleware/errorHandler'
import { Prisma } from '@prisma/client'

const router = Router()

// GET /regulator/work-orders — paginated list for regulators (read-only)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const status = req.query.status as string | undefined
    const search = req.query.search as string | undefined

    const where: Prisma.WorkOrderWhereInput = {}

    if (status && status !== 'all') {
      where.status = status as any
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { siteName: { contains: search, mode: 'insensitive' } },
        { contractor: { companyName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [items, total] = await Promise.all([
      workOrderRepository.findMany({ where, skip: (page - 1) * limit, take: limit }),
      workOrderRepository.count(where),
    ])

    res.json({ items, total })
  } catch (err) { next(err) }
})

// GET /regulator/work-orders/:id — read-only work order detail for regulators
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wo = await workOrderRepository.findByIdFull(req.params.id)
    if (!wo) throw new AppError(404, 'Work order not found')
    res.json(wo)
  } catch (err) { next(err) }
})

export default router
