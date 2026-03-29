import { Router } from 'express'
import authRouter          from './auth'
import notificationsRouter from './notifications'
import filesRouter         from './files'
import governoratesRouter  from './governorates'
import checklistRouter     from './checklist'
import adminRouter         from './admin/index'
import regulatorRouter     from './regulator/index'
import inspectorRouter     from './inspector/index'
import contractorRouter    from './contractor/index'

const router = Router()

// Public + auth routes
router.use('/auth',          authRouter)

// Shared authenticated routes
router.use('/notifications', notificationsRouter)
router.use('/files',         filesRouter)
router.use('/governorates',  governoratesRouter)
router.use('/checklist',     checklistRouter)

// Role-scoped routes
router.use('/admin',         adminRouter)
router.use('/regulator',     regulatorRouter)
router.use('/inspector',     inspectorRouter)
router.use('/contractor',    contractorRouter)

export default router
