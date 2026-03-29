import { Router } from 'express'
import * as reportController from '../../controllers/admin/report.controller'

const router = Router()

router.get('/inspector-workload',  reportController.inspectorWorkload)
router.get('/exports',             reportController.listExports)
router.get('/governorates',        reportController.governorates)

export default router
