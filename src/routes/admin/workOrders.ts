import { Router } from 'express'
import * as workOrderController from '../../controllers/admin/workOrder.controller'

const router = Router()

router.get('/',              workOrderController.list)
router.post('/',             workOrderController.create)
router.post('/bulk-import',  workOrderController.bulkImport)
router.get('/:id',           workOrderController.getById)
router.patch('/:id/assign',  workOrderController.assign)
router.patch('/:id/reopen',  workOrderController.reopen)
router.patch('/:id',         workOrderController.update)

export default router
