import { prisma } from '../lib/prisma'
import { UserRole, UserStatus, Prisma } from '@prisma/client'

export const userRepository = {
  findByEmail: (email: string) =>
    prisma.user.findUnique({
      where: { email },
      include: { contractorProfile: true, staffProfile: true, regulatorProfile: true },
    }),

  findById: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      include: { contractorProfile: true, staffProfile: true, regulatorProfile: true },
    }),

  findByIdSafe: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, role: true, status: true,
        lastLogin: true, createdAt: true, updatedAt: true,
        staffProfile: true, regulatorProfile: true,
      },
    }),

  findMany: (params: {
    where?: Prisma.UserWhereInput
    skip: number
    take: number
  }) =>
    prisma.user.findMany({
      where: params.where,
      select: {
        id: true, email: true, role: true, status: true,
        lastLogin: true, createdAt: true,
        staffProfile: true, regulatorProfile: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    }),

  count: (where: Prisma.UserWhereInput) =>
    prisma.user.count({ where }),

  findStatusesByEmails: (emails: string[]) =>
    prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true, status: true },
    }),

  findActiveAdmins: () =>
    prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' } }),

  updateLastLogin: (id: string) =>
    prisma.user.update({ where: { id }, data: { lastLogin: new Date() } }),

  updatePassword: (id: string, passwordHash: string) =>
    prisma.user.update({ where: { id }, data: { passwordHash } }),

  updateStatus: (id: string, status: UserStatus) =>
    prisma.user.update({ where: { id }, data: { status } }),

  create: (data: Parameters<typeof prisma.user.create>[0]['data']) =>
    prisma.user.create({ data, include: { staffProfile: true } }),

  staffProfileExists: (employeeId: string) =>
    prisma.staffProfile.findUnique({ where: { employeeId } }),

  updateStaffProfile: (userId: string, data: { fullName?: string; phone?: string }) =>
    prisma.staffProfile.update({ where: { userId }, data }),

  updateRegulatorProfile: (userId: string, data: { fullName?: string; phone?: string; organization?: string; department?: string | null }) =>
    prisma.regulatorProfile.update({ where: { userId }, data }),

  updateContractorProfile: (userId: string, data: { companyName?: string; contactName?: string; phone?: string }) =>
    prisma.contractorProfile.update({ where: { userId }, data }),
}
