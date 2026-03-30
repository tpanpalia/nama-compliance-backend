import { Router } from 'express'
import * as contractorController from '../../controllers/regulator/contractor.controller'

const router = Router()

router.get('/',                   contractorController.list)
router.get('/summary',            contractorController.getSummary)
router.get('/:cr',                contractorController.getById)
router.get('/:cr/performance',    contractorController.getPerformance)

export default router
