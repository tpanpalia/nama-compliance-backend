import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

export const notificationRepository = {
  findById: (id: string) =>
    prisma.notification.findUnique({ where: { id } }),

  findMany: (params: { where: Prisma.NotificationWhereInput; skip: number; take: number }) =>
    prisma.notification.findMany({
      where:   params.where,
      orderBy: { createdAt: 'desc' },
      skip:    params.skip,
      take:    params.take,
    }),

  count: (where: Prisma.NotificationWhereInput) =>
    prisma.notification.count({ where }),

  create: (data: Prisma.NotificationUncheckedCreateInput) =>
    prisma.notification.create({ data }),

  createMany: (args: { data: Prisma.NotificationCreateManyInput[] }) =>
    prisma.notification.createMany(args),

  markRead: (id: string) =>
    prisma.notification.update({ where: { id }, data: { isRead: true } }),

  markAllRead: (userId: string) =>
    prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }),
}
