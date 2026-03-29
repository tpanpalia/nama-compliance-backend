import { Router } from 'express'
import * as evidenceController from '../../controllers/inspector/evidence.controller'

const router = Router()

router.post('/',     evidenceController.create)
router.delete('/:id', evidenceController.remove)

export default router
