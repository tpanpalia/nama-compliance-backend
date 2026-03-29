import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { requireRole } from '../../middleware/requireRole'
import dashboardRouter     from './dashboard'
import workOrdersRouter    from './workOrders'
import contractorsRouter   from './contractors'
import usersRouter         from './users'
import accessRequestRouter from './accessRequests'
import checklistRouter     from './checklist'
import scoringRouter       from './scoring'
import reportsRouter       from './reports'

const router = Router()

router.use(authenticate)
router.use(requireRole('ADMIN'))

router.use('/dashboard',       dashboardRouter)
router.use('/work-orders',     workOrdersRouter)
router.use('/contractors',     contractorsRouter)
router.use('/users',           usersRouter)
router.use('/access-requests', accessRequestRouter)
router.use('/checklist',       checklistRouter)
router.use('/scoring-weights', scoringRouter)
router.use('/reports',         reportsRouter)

export default router
