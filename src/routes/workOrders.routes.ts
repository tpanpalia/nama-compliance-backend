import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  approveWorkOrderHandler,
  assignWorkOrderHandler,
  createWorkOrderHandler,
  getWorkOrderById,
  getWorkOrders,
  rejectWorkOrderHandler,
  reopenWorkOrderHandler,
  selfAssignWorkOrderHandler,
  startWorkOrderHandler,
  submitWorkOrderHandler,
} from '../controllers/workOrders.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { assignWorkOrderSchema, createWorkOrderSchema, rejectWorkOrderSchema, workOrderFilterSchema } from '../schemas/workOrder.schema';
import { idParamSchema } from '../schemas/common.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

router.get('/', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.REGULATOR), validate({ query: workOrderFilterSchema }), getWorkOrders);
router.get('/:id', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: idParamSchema }), getWorkOrderById);
router.post('/', authorize(UserRole.ADMIN), validate({ body: createWorkOrderSchema }), createWorkOrderHandler);
router.patch('/:id/assign', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: assignWorkOrderSchema }), assignWorkOrderHandler);
router.post('/:id/self-assign', authorize(UserRole.INSPECTOR), validate({ params: idParamSchema }), selfAssignWorkOrderHandler);
router.patch('/:id/start', authorize(UserRole.INSPECTOR), validate({ params: idParamSchema }), startWorkOrderHandler);
router.post('/:id/submit', authorize(UserRole.INSPECTOR), validate({ params: idParamSchema }), submitWorkOrderHandler);
router.patch('/:id/approve', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), approveWorkOrderHandler);
router.patch('/:id/reject', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: rejectWorkOrderSchema }), rejectWorkOrderHandler);
router.patch('/:id/reopen', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), reopenWorkOrderHandler);

export default router;
