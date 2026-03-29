import { Router } from 'express'
import * as scoringController from '../../controllers/admin/scoring.controller'

const router = Router()

router.get('/',   scoringController.list)
router.post('/',  scoringController.create)

export default router
