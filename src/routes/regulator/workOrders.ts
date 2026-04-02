import { Router, Request, Response, NextFunction } from 'express'
import { workOrderRepository } from '../../repositories/workOrder.repository'
import { AppError } from '../../middleware/errorHandler'

const router = Router()

// GET /regulator/work-orders/:id — read-only work order detail for regulators
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wo = await workOrderRepository.findByIdFull(req.params.id)
    if (!wo) throw new AppError(404, 'Work order not found')
    res.json(wo)
  } catch (err) { next(err) }
})

export default router
