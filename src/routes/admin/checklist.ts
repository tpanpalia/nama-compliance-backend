import { Router } from 'express'
import * as checklistController from '../../controllers/admin/checklist.controller'

const router = Router()

router.get('/',                     checklistController.list)
router.post('/',                    checklistController.create)
router.patch('/:id/deactivate',     checklistController.deactivate)

export default router
