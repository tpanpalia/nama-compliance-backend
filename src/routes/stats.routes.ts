import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { getDashboardStats } from '../controllers/stats.controller';
import { authorize } from '../middleware/authorize';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

router.get('/dashboard', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), getDashboardStats);

export default router;
