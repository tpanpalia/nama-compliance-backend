import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { downloadReport, generateReport, getReportById, listReports } from '../controllers/reports.controller';
import { authorize } from '../middleware/authorize';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

router.get('/', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), listReports);
router.post('/generate', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), generateReport);
router.get('/:id', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), getReportById);
router.get('/:id/download', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), downloadReport);

export default router;
