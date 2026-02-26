import { EvidenceType } from '@prisma/client';
import { z } from 'zod';

export const requestUploadSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.nativeEnum(EvidenceType),
  contentType: z.string().min(1),
  fileSize: z.number().int().positive(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracy: z.number().optional(),
});

export const confirmUploadSchema = z.object({
  evidenceId: z.string().uuid(),
  key: z.string().min(1),
});
