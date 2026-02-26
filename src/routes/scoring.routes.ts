import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { getScoringConfigController, updateScoringConfigController } from '../controllers/scoring.controller';
import { authorize } from '../middleware/authorize';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

router.get('/config', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), getScoringConfigController);
router.patch('/config', authorize(UserRole.ADMIN), updateScoringConfigController);

export default router;
