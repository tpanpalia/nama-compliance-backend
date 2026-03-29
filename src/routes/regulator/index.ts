import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { requireRole } from '../../middleware/requireRole'
import dashboardRouter   from './dashboard'
import contractorsRouter from './contractors'

const router = Router()

router.use(authenticate)
router.use(requireRole('REGULATOR', 'ADMIN'))

router.use('/dashboard',   dashboardRouter)
router.use('/contractors', contractorsRouter)

export default router
