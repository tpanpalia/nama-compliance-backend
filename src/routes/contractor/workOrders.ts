import { Router } from 'express'
import * as workOrderController from '../../controllers/contractor/workOrder.controller'

const router = Router()

router.get('/',               workOrderController.list)
router.get('/:id',            workOrderController.getById)
router.patch('/:id/start',    workOrderController.start)
router.post('/:id/submit',    workOrderController.submit)
router.post('/:id/evidence',  workOrderController.addEvidence)

export default router
