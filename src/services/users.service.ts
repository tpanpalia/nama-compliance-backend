import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { IdentityRole } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
  role: z.enum(['INSPECTOR', 'ADMIN', 'REGULATOR']),
  organisation: z.string().optional(),
  department: z.string().optional(),
});

export const UpdateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

const USER_SELECT = {
  id: true,
  displayName: true,
  role: true,
  organisation: true,
  department: true,
  isActive: true,
  createdAt: true,
  identity: { select: { email: true, isActive: true } },
  _count: { select: { assignedWorkOrders: true, createdWorkOrders: true } },
};

export async function listUsers(filters: { role?: string; isActive?: boolean }) {
  return prisma.user.findMany({
    where: {
      ...(filters.role && { role: filters.role as any }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    },
    select: USER_SELECT,
    orderBy: { displayName: 'asc' },
  });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function createUser(data: z.infer<typeof CreateUserSchema>) {
  const existing = await prisma.identity.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('A user with this email already exists', 409);
  const password = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: {
      displayName: data.displayName,
      role: data.role,
      organisation: data.organisation,
      department: data.department,
      isActive: true,
      identity: {
        create: {
          email: data.email,
          password,
          role: data.role as IdentityRole,
          isActive: true,
        },
      },
    },
    select: USER_SELECT,
  });
}

export async function updateUserStatus(id: string, isActive: boolean, requestingUserId: string) {
  if (id === requestingUserId) {
    throw new AppError('You cannot deactivate your own account', 400);
  }
  await getUserById(id);
  return prisma.user.update({
    where: { id },
    data: { isActive },
    select: USER_SELECT,
  });
}
