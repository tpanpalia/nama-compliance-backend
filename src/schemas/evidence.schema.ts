import { EvidenceType } from '@prisma/client';
import { z } from 'zod';

export const requestUploadSchema = z.object({
  checklistItemId: z.string().uuid(),
  fileName: z.string().min(1).optional(),
  fileType: z.nativeEnum(EvidenceType).optional(),
  type: z.nativeEnum(EvidenceType).optional(),
  contentType: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  fileSize: z.number().int().positive(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracy: z.number().optional(),
  capturedAt: z.string().datetime().optional(),
});

export const confirmUploadSchema = z.object({
  evidenceId: z.string().uuid(),
  key: z.string().min(1).optional(),
});
