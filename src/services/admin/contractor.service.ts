import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { UserStatus } from '@prisma/client'
import { AppError } from '../../middleware/errorHandler'
import { contractorRepository } from '../../repositories/contractor.repository'
import { accessRequestRepository } from '../../repositories/accessRequest.repository'
import { auditLogRepository } from '../../repositories/auditLog.repository'
import { dashboardRepository } from '../../repositories/dashboard.repository'
import { userRepository } from '../../repositories/user.repository'
import { generateRequestId } from '../../utils/ids'

export const adminContractorService = {
  create: async (performedBy: string, data: {
    companyName: string
    contactName: string
    email: string
    phone: string
    crNumber: string
    address?: string
    regionsOfOperation?: string[]
  }) => {
    const exists = await userRepository.findByEmail(data.email.toLowerCase())
    if (exists) throw new AppError(409, 'Email already in use')

    const crExists = await contractorRepository.findByCr(data.crNumber)
    if (crExists) throw new AppError(409, 'CR number already registered')

    const tempPassword = `Temp@${crypto.randomBytes(6).toString('hex').toUpperCase()}`
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const user = await contractorRepository.createWithUser({
      email:        data.email.toLowerCase(),
      passwordHash,
      role:         'CONTRACTOR',
      status:       'ACTIVE',
      contractorProfile: {
        create: {
          crNumber:           data.crNumber,
          companyName:        data.companyName,
          contactName:        data.contactName,
          email:              data.email.toLowerCase(),
          phone:              data.phone,
          address:            data.address,
          regionsOfOperation: data.regionsOfOperation ?? [],
        },
      },
    })

    // Create an auto-approved AccessRequest for audit trail
    const requestId = await generateRequestId()
    await accessRequestRepository.create({
      id:                 requestId,
      applicantName:      data.contactName,
      email:              data.email.toLowerCase(),
      phone:              data.phone,
      roleRequested:      'CONTRACTOR',
      contractorCr:       data.crNumber,
      organization:       data.companyName,
      status:             'APPROVED',
      verificationStatus: 'VERIFIED',
      reviewedBy:         performedBy,
      reviewedAt:         new Date(),
    })

    await auditLogRepository.create({
      performedBy,
      entityType: 'CONTRACTOR',
      entityId:   data.crNumber,
      action:     'CREATED',
      metadata:   { email: data.email, companyName: data.companyName },
    })

    return { ok: true, userId: user.id, crNumber: data.crNumber, tempPassword }
  },

  list: async (params: { status?: string; search?: string; page: number; limit: number }) => {
    const skip  = (params.page - 1) * params.limit
    const where = {
      user: {
        role: 'CONTRACTOR' as const,
        ...(params.status ? { status: params.status as UserStatus } : {}),
      },
      ...(params.search ? {
        OR: [
          { companyName: { contains: params.search, mode: 'insensitive' as const } },
          { crNumber:    { contains: params.search, mode: 'insensitive' as const } },
          { contactName: { contains: params.search, mode: 'insensitive' as const } },
          { email:       { contains: params.search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [items, total] = await Promise.all([
      contractorRepository.findMany({ where, skip, take: params.limit }),
      contractorRepository.count(where),
    ])

    return { items, total }
  },

  getById: async (cr: string) => {
    const contractor = await contractorRepository.findByCrFull(cr)
    if (!contractor) throw new AppError(404, 'Contractor not found')
    return contractor
  },

  getPerformance: async (cr: string, year: number, month: number) => {
    const result = await dashboardRepository.getContractorPerformance(cr, year, month)
    return (result[0] as Record<string, unknown>)['get_contractor_performance']
  },

  update: async (performedBy: string, cr: string, data: {
    companyName?: string
    contactName?: string
    email?: string
    phone?: string
    address?: string
    regionsOfOperation?: string[]
  }) => {
    const contractor = await contractorRepository.findByCr(cr)
    if (!contractor) throw new AppError(404, 'Contractor not found')

    const updated = await contractorRepository.update(cr, data)

    await auditLogRepository.create({
      performedBy,
      entityType: 'CONTRACTOR',
      entityId:   cr,
      action:     'UPDATED',
      metadata:   data,
    })

    return updated
  },

  updateStatus: async (performedBy: string, cr: string, status: string, reason?: string) => {
    const contractor = await contractorRepository.findByCrWithUser(cr)
    if (!contractor) throw new AppError(404, 'Contractor not found')

    await contractorRepository.updateUserStatus(contractor.userId, status as UserStatus)

    const action = status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVATED'
    await auditLogRepository.create({
      performedBy,
      entityType: 'CONTRACTOR',
      entityId:   cr,
      action,
      metadata:   { status, reason },
    })

    return { ok: true, status }
  },
}
