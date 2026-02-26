import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  approveAccessRequest,
  createAccessRequest,
  getAccessRequestById,
  listAccessRequests,
  rejectAccessRequest,
} from '../controllers/accessRequests.controller';
import { authorize } from '../middleware/authorize';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';
import { accessRequestSchema, rejectRequestSchema } from '../schemas/contractor.schema';

const router = Router();

router.post('/', validate({ body: accessRequestSchema }), createAccessRequest);
router.use(authenticate);
router.get('/', authorize(UserRole.ADMIN), listAccessRequests);
router.get('/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), getAccessRequestById);
router.patch('/:id/approve', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), approveAccessRequest);
router.patch('/:id/reject', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: rejectRequestSchema }), rejectAccessRequest);

export default router;
