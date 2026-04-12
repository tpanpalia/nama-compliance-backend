import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { UserRole, UserStatus } from '@prisma/client'
import { AppError } from '../../middleware/errorHandler'
import { userRepository } from '../../repositories/user.repository'
import { auditLogRepository } from '../../repositories/auditLog.repository'

export const adminUserService = {
  list: async (params: { role?: string; status?: string; search?: string; page: number; limit: number }) => {
    const skip  = (params.page - 1) * params.limit
    const where = {
      ...(params.role   ? { role:   params.role   as UserRole }   : {}),
      ...(params.status ? { status: params.status as UserStatus } : {}),
      ...(params.search ? {
        OR: [
          { email:        { contains: params.search, mode: 'insensitive' as const } },
          { staffProfile: { fullName: { contains: params.search, mode: 'insensitive' as const } } },
        ],
      } : {}),
    }

    const [items, total] = await Promise.all([
      userRepository.findMany({ where, skip, take: params.limit }),
      userRepository.count(where),
    ])

    return { items, total }
  },

  getById: async (id: string) => {
    const user = await userRepository.findByIdSafe(id)
    if (!user) throw new AppError(404, 'User not found')
    return user
  },

  create: async (performedBy: string, data: {
    email: string
    role: 'INSPECTOR' | 'ADMIN'
    employeeId: string
    fullName: string
    phone: string
  }) => {
    const exists = await userRepository.findByEmail(data.email.toLowerCase())
    if (exists) throw new AppError(409, 'Email already in use')

    const empExists = await userRepository.staffProfileExists(data.employeeId)
    if (empExists) throw new AppError(409, 'Employee ID already in use')

    const tempPassword = `Temp@${crypto.randomBytes(6).toString('hex').toUpperCase()}`
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const user = await userRepository.create({
      email:        data.email.toLowerCase(),
      passwordHash,
      role:         data.role,
      status:       'ACTIVE',
      staffProfile: {
        create: { employeeId: data.employeeId, fullName: data.fullName, phone: data.phone },
      },
    })

    await auditLogRepository.create({
      performedBy,
      entityType: 'USER',
      entityId:   user.id,
      action:     'CREATED',
      metadata:   { role: data.role, email: data.email },
    })

    const { passwordHash: _, ...safeUser } = user
    return { ...safeUser, tempPassword }
  },

  updateStatus: async (performedBy: string, targetId: string, status: UserStatus, requesterId: string) => {
    const user = await userRepository.findById(targetId)
    if (!user) throw new AppError(404, 'User not found')
    if (targetId === requesterId) throw new AppError(400, 'Cannot change your own status')

    await userRepository.updateStatus(targetId, status)

    await auditLogRepository.create({
      performedBy,
      entityType: 'USER',
      entityId:   targetId,
      action:     status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVATED',
      metadata:   { status },
    })

    return { ok: true, status }
  },
}
