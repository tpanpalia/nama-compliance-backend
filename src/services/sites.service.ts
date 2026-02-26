import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const CreateSiteSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  region: z.string().min(2),
});

export const UpdateSiteSchema = z.object({
  name: z.string().min(2).optional(),
  location: z.string().min(2).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  region: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});

export type CreateSiteInput = z.infer<typeof CreateSiteSchema>;
export type UpdateSiteInput = z.infer<typeof UpdateSiteSchema>;

export async function listSites(filters: { region?: string; isActive?: boolean }) {
  return prisma.site.findMany({
    where: {
      ...(filters.region && { region: filters.region }),
      isActive: filters.isActive !== undefined ? filters.isActive : true,
    },
    include: { _count: { select: { workOrders: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getSiteById(id: string) {
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      _count: { select: { workOrders: true } },
      workOrders: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, reference: true, status: true, createdAt: true },
      },
    },
  });
  if (!site) throw new AppError('Site not found', 404);
  return site;
}

export async function createSite(data: CreateSiteInput) {
  return prisma.site.create({ data });
}

export async function updateSite(id: string, data: UpdateSiteInput) {
  await getSiteById(id);
  return prisma.site.update({ where: { id }, data });
}
