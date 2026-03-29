import { Router } from 'express'
import * as workOrderController from '../../controllers/inspector/workOrder.controller'

const router = Router()

router.get('/',          workOrderController.list)
router.get('/:id',       workOrderController.getById)
router.post('/:id/claim', workOrderController.claim)

export default router
