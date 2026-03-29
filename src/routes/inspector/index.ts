import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { requireRole } from '../../middleware/requireRole'
import workOrdersRouter  from './workOrders'
import inspectionsRouter from './inspections'
import evidenceRouter    from './evidence'

const router = Router()

router.use(authenticate)
router.use(requireRole('INSPECTOR'))

router.use('/work-orders',  workOrdersRouter)
router.use('/inspections',  inspectionsRouter)
router.use('/evidence',     evidenceRouter)

export default router
