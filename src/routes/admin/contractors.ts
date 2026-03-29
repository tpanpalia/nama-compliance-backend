import { Router } from 'express'
import * as contractorController from '../../controllers/admin/contractor.controller'

const router = Router()

router.get('/',                     contractorController.list)
router.get('/:cr',                  contractorController.getById)
router.get('/:cr/performance',      contractorController.getPerformance)
router.patch('/:cr/status',         contractorController.updateStatus)

export default router
