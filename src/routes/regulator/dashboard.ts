import { Router } from 'express'
import * as dashboardController from '../../controllers/regulator/dashboard.controller'
import { getYearRange } from '../../controllers/admin/dashboard.controller'

const router = Router()

router.get('/', dashboardController.get)
router.get('/years', getYearRange)

export default router
