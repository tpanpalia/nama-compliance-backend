import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { generateContractorId } from '../types';

export const UpdateContractorStatusSchema = z.object({
  isActive: z.boolean(),
});

const CONTRACTOR_SELECT = {
  id: true,
  contractorId: true,
  companyName: true,
  contactName: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  _count: { select: { workOrders: true } },
};

export async function listContractors(filters: { search?: string; isActive?: boolean; page: number; limit: number }) {
  const { search, isActive, page, limit } = filters;
  const where: any = {
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { contractorId: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.contractor.findMany({
      where,
      select: CONTRACTOR_SELECT,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { companyName: 'asc' },
    }),
    prisma.contractor.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getContractorById(id: string) {
  const contractor = await prisma.contractor.findUnique({
    where: { id },
    select: {
      ...CONTRACTOR_SELECT,
      workOrders: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, reference: true, status: true, overallScore: true },
      },
    },
  });
  if (!contractor) throw new AppError('Contractor not found', 404);
  return contractor;
}

export async function getContractorPerformance(id: string) {
  await getContractorById(id);

  const workOrders = await prisma.workOrder.findMany({
    where: { contractorId: id, status: 'APPROVED' },
    select: {
      overallScore: true,
      complianceBand: true,
      checklist: {
        select: {
          responses: {
            select: {
              rating: true,
              item: { select: { section: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  const totalInspections = workOrders.length;
  const scores = workOrders.map((w) => w.overallScore).filter(Boolean) as number[];
  const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

  const categoryTotals: Record<string, { sum: number; count: number }> = {};
  const POINTS: Record<string, number> = { COMPLIANT: 100, PARTIAL: 67, NON_COMPLIANT: 33 };
  workOrders.forEach((wo) => {
    wo.checklist?.responses.forEach((r) => {
      const section = r.item.section.name;
      if (!categoryTotals[section]) categoryTotals[section] = { sum: 0, count: 0 };
      if (r.rating) {
        categoryTotals[section].sum += POINTS[r.rating] || 0;
        categoryTotals[section].count += 1;
      }
    });
  });

  const complianceByCategory = Object.fromEntries(
    Object.entries(categoryTotals).map(([k, v]) => [k, v.count ? Math.round((v.sum / v.count) * 10) / 10 : null])
  );

  return { totalInspections, avgScore, complianceByCategory };
}

export async function updateContractorStatus(id: string, isActive: boolean) {
  await getContractorById(id);
  return prisma.contractor.update({
    where: { id },
    data: { isActive },
    select: { id: true, contractorId: true, isActive: true },
  });
}
