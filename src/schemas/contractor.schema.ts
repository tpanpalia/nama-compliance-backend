import { z } from 'zod';

export const contractorStatusSchema = z.object({
  isActive: z.boolean(),
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
