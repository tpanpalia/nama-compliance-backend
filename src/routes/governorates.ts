import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as governorateController from '../controllers/governorate.controller'

const router = Router()
router.use(authenticate)

router.get('/', governorateController.list)

export default router
