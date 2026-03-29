import { AppError } from '../middleware/errorHandler'
import { notificationRepository } from '../repositories/notification.repository'

export const notificationService = {
  list: async (userId: string, params: { unread?: string; page: number; limit: number }) => {
    const skip = (params.page - 1) * params.limit
    const where = {
      userId,
      ...(params.unread === 'true' ? { isRead: false } : {}),
    }

    const [items, total, unreadCount] = await Promise.all([
      notificationRepository.findMany({ where, skip, take: params.limit }),
      notificationRepository.count(where),
      notificationRepository.count({ userId, isRead: false }),
    ])

    return { items, total, unreadCount }
  },

  getById: async (userId: string, notificationId: string) => {
    const n = await notificationRepository.findById(notificationId)
    if (!n || n.userId !== userId) throw new AppError(404, 'Notification not found')
    return n
  },

  markRead: async (userId: string, notificationId: string) => {
    const n = await notificationRepository.findById(notificationId)
    if (!n || n.userId !== userId) throw new AppError(404, 'Notification not found')

    await notificationRepository.markRead(notificationId)
    return { ok: true }
  },

  markAllRead: async (userId: string) => {
    await notificationRepository.markAllRead(userId)
    return { ok: true }
  },
}
