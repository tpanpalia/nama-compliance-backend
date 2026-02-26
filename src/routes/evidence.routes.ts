import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  confirmEvidenceUpload,
  deleteEvidenceHandler,
  getEvidenceByWorkOrder,
  requestPresignedUpload,
} from '../controllers/evidence.controller';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { evidenceIdParamSchema, workOrderIdParamSchema } from '../schemas/common.schema';
import { confirmUploadSchema, requestUploadSchema } from '../schemas/evidence.schema';
import { EXTERNAL_USER_ROLES } from '../types/roles';

const router = Router();

router.get('/work-orders/:workOrderId/evidence', authorize(UserRole.ADMIN, UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR, EXTERNAL_USER_ROLES.REGULATOR), validate({ params: workOrderIdParamSchema }), getEvidenceByWorkOrder);
router.post('/work-orders/:workOrderId/presigned-upload', authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR), validate({ params: workOrderIdParamSchema, body: requestUploadSchema }), requestPresignedUpload);
router.post('/work-orders/:workOrderId/confirm-upload', authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR), validate({ params: workOrderIdParamSchema, body: confirmUploadSchema }), confirmEvidenceUpload);
router.delete('/:evidenceId', authorize(UserRole.INSPECTOR, EXTERNAL_USER_ROLES.CONTRACTOR), validate({ params: evidenceIdParamSchema }), deleteEvidenceHandler);

export default router;
