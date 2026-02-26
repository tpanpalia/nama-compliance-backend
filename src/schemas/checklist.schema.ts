import { RatingValue } from '@prisma/client';
import { z } from 'zod';

export const autoSaveChecklistSchema = z.object({
  responses: z.array(
    z.object({
      itemId: z.string().uuid(),
      rating: z.nativeEnum(RatingValue).nullable(),
      comment: z.string().optional(),
    })
  ),
});

export const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const sectionSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
  order: z.number().int().min(1),
});

export const itemSchema = z.object({
  text: z.string().min(1),
  isRequired: z.boolean().default(true),
  order: z.number().int().min(1),
});

export const reorderItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      sectionId: z.string().uuid(),
      order: z.number().int().min(1),
    })
  ),
});
