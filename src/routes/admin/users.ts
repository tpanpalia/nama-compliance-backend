import { Router } from 'express'
import * as userController from '../../controllers/admin/user.controller'

const router = Router()

router.get('/',               userController.list)
router.post('/',              userController.create)
router.get('/:id',            userController.getById)
router.patch('/:id/status',   userController.updateStatus)

export default router
