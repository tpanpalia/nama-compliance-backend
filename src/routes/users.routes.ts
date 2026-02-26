import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { getMyUserProfile, getUserById, listUsers, updateUserStatus } from '../controllers/users.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common.schema';
import { contractorStatusSchema } from '../schemas/contractor.schema';

const router = Router();

router.get('/me', authorize(UserRole.INSPECTOR, UserRole.ADMIN), getMyUserProfile);
router.get('/', authorize(UserRole.ADMIN), listUsers);
router.get('/:id', authorize(UserRole.ADMIN), validate({ params: idParamSchema }), getUserById);
router.patch('/:id/status', authorize(UserRole.ADMIN), validate({ params: idParamSchema, body: contractorStatusSchema }), updateUserStatus);

export default router;
