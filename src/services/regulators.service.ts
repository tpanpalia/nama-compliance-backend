import bcrypt from 'bcryptjs';
import { IdentityRole, UserRole } from '@prisma/client';
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
  displayName: true,
  organisation: true,
  department: true,
  isActive: true,
  createdAt: true,
  identity: {
    select: {
      email: true,
      isActive: true,
    },
  },
};

export async function listRegulators(filters: { isActive?: boolean }) {
  return prisma.user.findMany({
    where: {
      role: UserRole.REGULATOR,
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    },
    select: REGULATOR_SELECT,
    orderBy: { displayName: 'asc' },
  });
}

export async function getRegulatorById(id: string) {
  const regulator = await prisma.user.findFirst({
    where: { id, role: UserRole.REGULATOR },
    select: REGULATOR_SELECT,
  });
  if (!regulator) throw new AppError('Regulator not found', 404);
  return regulator;
}

export async function createRegulator(data: z.infer<typeof CreateRegulatorSchema>) {
  const existing = await prisma.identity.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('A regulator with this email already exists', 409);

  const password = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: {
      displayName: data.displayName,
      role: UserRole.REGULATOR,
      organisation: data.organisation,
      department: data.department,
      isActive: true,
      identity: {
        create: {
          email: data.email,
          password,
          role: IdentityRole.REGULATOR,
          isActive: true,
        },
      },
    },
    select: REGULATOR_SELECT,
  });
}

export async function updateRegulatorStatus(id: string, isActive: boolean) {
  await getRegulatorById(id);
  return prisma.user.update({
    where: { id },
    data: {
      isActive,
      identity: {
        update: { isActive },
      },
    },
    select: {
      id: true,
      isActive: true,
      identity: { select: { email: true } },
    },
  });
}
