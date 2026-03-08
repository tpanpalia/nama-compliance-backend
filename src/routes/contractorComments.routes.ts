import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authorize } from '../middleware/authorize';
import * as ContractorCommentsController from '../controllers/contractorComments.controller';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

router.post('/', authorize(EXTERNAL_USER_ROLES.CONTRACTOR), ContractorCommentsController.upsertComment);

router.get(
  '/work-order/:workOrderId',
  authorize(UserRole.ADMIN, UserRole.INSPECTOR, UserRole.REGULATOR, EXTERNAL_USER_ROLES.CONTRACTOR),
  ContractorCommentsController.getCommentsForWorkOrder
);

export default router;
