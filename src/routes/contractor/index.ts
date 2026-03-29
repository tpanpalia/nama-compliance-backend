import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { requireRole } from '../../middleware/requireRole'
import workOrdersRouter from './workOrders'

const router = Router()

router.use(authenticate)
router.use(requireRole('CONTRACTOR'))

router.use('/work-orders', workOrdersRouter)

export default router
