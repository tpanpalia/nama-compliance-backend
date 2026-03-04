import { WorkOrderPriority, WorkOrderStatus } from '@prisma/client';
import { z } from 'zod';

export const createWorkOrderSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  siteId: z.string().uuid(),
  contractorId: z.string().uuid().optional(),
  priority: z.nativeEnum(WorkOrderPriority).default(WorkOrderPriority.MEDIUM),
  scheduledDate: z.string().datetime().optional(),
});

export const assignWorkOrderSchema = z.object({
  inspectorId: z.string().uuid(),
  contractorId: z.string().uuid(),
});

export const rejectWorkOrderSchema = z.object({
  reason: z.string().min(3),
});

export const workOrderFilterSchema = z.object({
  status: z.union([z.nativeEnum(WorkOrderStatus), z.array(z.nativeEnum(WorkOrderStatus)), z.string()]).optional(),
  year: z.union([z.coerce.number().int(), z.array(z.coerce.number().int()), z.string(), z.array(z.string())]).optional(),
  month: z
    .union([z.coerce.number().int().min(1).max(12), z.array(z.coerce.number().int().min(1).max(12)), z.string(), z.array(z.string())])
    .optional(),
  inspectorId: z.string().uuid().optional(),
  contractorId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  priority: z.nativeEnum(WorkOrderPriority).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
