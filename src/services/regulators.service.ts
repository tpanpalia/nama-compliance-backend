import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const CreateRegulatorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
  organisation: z.string().min(2),
  department: z.string().optional(),
});

export const UpdateRegulatorStatusSchema = z.object({
  isActive: z.boolean(),
});

const REGULATOR_SELECT = {
  id: true,
  email: true,
  displayName: true,
  organisation: true,
  department: true,
  isActive: true,
  createdAt: true,
};

export async function listRegulators(filters: { isActive?: boolean }) {
  return prisma.regulator.findMany({
    where: { ...(filters.isActive !== undefined && { isActive: filters.isActive }) },
    select: REGULATOR_SELECT,
    orderBy: { displayName: 'asc' },
  });
}

export async function getRegulatorById(id: string) {
  const regulator = await prisma.regulator.findUnique({ where: { id }, select: REGULATOR_SELECT });
  if (!regulator) throw new AppError('Regulator not found', 404);
  return regulator;
}

export async function createRegulator(data: z.infer<typeof CreateRegulatorSchema>) {
  const existing = await prisma.regulator.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('A regulator with this email already exists', 409);
  const password = await bcrypt.hash(data.password, 10);
  return prisma.regulator.create({
    data: { ...data, password },
    select: REGULATOR_SELECT,
  });
}

export async function updateRegulatorStatus(id: string, isActive: boolean) {
  await getRegulatorById(id);
  return prisma.regulator.update({
    where: { id },
    data: { isActive },
    select: { id: true, email: true, isActive: true },
  });
}
