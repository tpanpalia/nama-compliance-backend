import { Router } from 'express'
import * as contractorController from '../../controllers/admin/contractor.controller'

const router = Router()

router.post('/',                    contractorController.create)
router.get('/',                     contractorController.list)
router.get('/summary',              contractorController.getSummary)
router.get('/:cr',                  contractorController.getById)
router.get('/:cr/performance',      contractorController.getPerformance)
router.patch('/:cr/status',         contractorController.updateStatus)

export default router
