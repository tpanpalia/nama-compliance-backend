import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  contractorPerformance,
  getContractorById,
  getMyContractorProfile,
  listContractors,
  updateContractorStatus,
} from '../controllers/contractors.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';
import { contractorStatusSchema } from '../schemas/contractor.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

router.get('/', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), listContractors);
router.get('/me', authorize(EXTERNAL_USER_ROLES.CONTRACTOR), getMyContractorProfile);
router.get('/:id', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), getContractorById);
router.get('/:id/performance', authorize(UserRole.ADMIN, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), contractorPerformance);
router.patch('/:id/status', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: contractorStatusSchema }), updateContractorStatus);

export default router;
