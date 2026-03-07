import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
  role: z.enum(['INSPECTOR', 'ADMIN']),
});

export const UpdateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
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
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('A user with this email already exists', 409);
  const password = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: { ...data, password },
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
