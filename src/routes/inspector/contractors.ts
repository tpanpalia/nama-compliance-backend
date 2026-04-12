import { Router } from 'express'
import * as contractorController from '../../controllers/admin/contractor.controller'

const router = Router()

// Inspectors can view contractors (read-only: list, get by CR, performance)
router.get('/',                     contractorController.list)
router.get('/:cr',                  contractorController.getById)
router.get('/:cr/performance',      contractorController.getPerformance)

export default router
