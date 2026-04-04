import { Router } from 'express'
import * as accessRequestController from '../../controllers/admin/accessRequest.controller'

const router = Router()

router.get('/',               accessRequestController.list)
router.get('/:id',            accessRequestController.getById)
router.post('/:id/approve',   accessRequestController.approve)
router.post('/:id/reject',    accessRequestController.reject)
router.post('/:id/deactivate', accessRequestController.deactivate)
router.patch('/:id/verify',   accessRequestController.verifyDocument)

export default router
