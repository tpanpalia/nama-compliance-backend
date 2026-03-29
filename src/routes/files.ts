import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as fileController from '../controllers/file.controller'

const router = Router()
router.use(authenticate)

router.post('/presign',       fileController.presign)
router.patch('/:id/confirm',  fileController.confirm)
router.get('/:id/url',        fileController.getUrl)

export default router
