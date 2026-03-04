import { z } from 'zod';

export const contractorStatusSchema = z.object({
  isActive: z.boolean(),
});

export const contractorFilterSchema = z.object({
  status: z.union([z.string(), z.array(z.string())]).optional(),
  year: z.union([z.coerce.number().int(), z.array(z.coerce.number().int()), z.string(), z.array(z.string())]).optional(),
  month: z
    .union([z.coerce.number().int().min(1).max(12), z.array(z.coerce.number().int().min(1).max(12)), z.string(), z.array(z.string())])
    .optional(),
  isActive: z.union([z.boolean(), z.string(), z.array(z.string())]).optional(),
});

export const accessRequestSchema = z.object({
  companyName: z.string().min(1),
  tradeLicense: z.string().min(1),
  crNumber: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(5),
});

export const rejectRequestSchema = z.object({
  reason: z.string().min(3),
});
