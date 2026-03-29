import { Router } from 'express'
import * as inspectionController from '../../controllers/inspector/inspection.controller'

const router = Router()

router.get('/',                     inspectionController.list)
router.get('/:id',                  inspectionController.getById)
router.post('/:id/start',           inspectionController.start)
router.put('/:id/responses',        inspectionController.saveResponses)
router.post('/:id/submit',          inspectionController.submit)

export default router
