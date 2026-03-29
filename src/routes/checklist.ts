import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as checklistController from '../controllers/checklist.controller'

const router = Router()
router.use(authenticate)

router.get('/', checklistController.list)

export default router
