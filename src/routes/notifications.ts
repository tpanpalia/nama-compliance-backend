import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as notificationController from '../controllers/notification.controller'

const router = Router()
router.use(authenticate)

router.get('/',            notificationController.list)
router.patch('/read-all',  notificationController.markAllRead)  // must come before /:id
router.get('/:id',         notificationController.getById)
router.patch('/:id/read',  notificationController.markRead)

export default router
