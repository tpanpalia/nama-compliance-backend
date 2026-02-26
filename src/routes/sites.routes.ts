import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { createSite, getSiteById, listSites, nearbySites, updateSite } from '../controllers/sites.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

router.get('/', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), listSites);
router.get('/nearby', authorize(EXTERNAL_USER_ROLES.CONTRACTOR), nearbySites);
router.get('/:id', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), getSiteById);
router.post('/', authorize(UserRole.ADMIN), createSite);
router.patch('/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), updateSite);

export default router;
