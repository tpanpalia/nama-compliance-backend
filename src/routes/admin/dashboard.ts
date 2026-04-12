import { Router } from 'express'
import * as dashboardController from '../../controllers/admin/dashboard.controller'

const router = Router()

router.get('/', dashboardController.get)
router.get('/years', dashboardController.getYearRange)

export default router
