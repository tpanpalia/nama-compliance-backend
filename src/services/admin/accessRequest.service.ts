import bcrypt from 'bcryptjs'
import { AppError } from '../../middleware/errorHandler'
import { accessRequestRepository } from '../../repositories/accessRequest.repository'
import { userRepository } from '../../repositories/user.repository'
import { contractorRepository } from '../../repositories/contractor.repository'
import { auditLogRepository } from '../../repositories/auditLog.repository'
import { notificationRepository } from '../../repositories/notification.repository'

export const accessRequestService = {
  list: async (params: { status?: string; role?: string; page: number; limit: number }) => {
    const skip  = (params.page - 1) * params.limit
    const where = {
      ...(params.status ? { status:        params.status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
      ...(params.role   ? { roleRequested: params.role   as 'CONTRACTOR' | 'REGULATOR' }          : {}),
    }

    const [items, total] = await Promise.all([
      accessRequestRepository.findMany({ where, skip, take: params.limit }),
      accessRequestRepository.count(where),
    ])

    return { items, total }
  },

  getById: async (id: string) => {
    const request = await accessRequestRepository.findByIdWithFile(id)
    if (!request) throw new AppError(404, 'Access request not found')
    return request
  },

  approve: async (performedBy: string, requestId: string) => {
    const request = await accessRequestRepository.findById(requestId)
    if (!request) throw new AppError(404, 'Access request not found')
    if (request.status !== 'PENDING') throw new AppError(400, 'Request is not pending')

    const existingUser = await userRepository.findByEmail(request.email)
    if (existingUser) throw new AppError(409, 'A user with this email already exists')

    const tempPassword = `Temp@${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    let userId: string

    if (request.roleRequested === 'CONTRACTOR') {
      if (!request.contractorCr) throw new AppError(400, 'CR Number missing from request')

      const crExists = await contractorRepository.findByCr(request.contractorCr)
      if (crExists) throw new AppError(409, 'A contractor with this CR number already exists')

      const user = await contractorRepository.createWithUser({
        email:        request.email,
        passwordHash,
        role:         'CONTRACTOR',
        status:       'ACTIVE',
        contractorProfile: {
          create: {
            crNumber:    request.contractorCr,
            companyName: request.applicantName,
            contactName: request.applicantName,
            email:       request.email,
            phone:       request.phone ?? '',
          },
        },
      })
      userId = user.id
    } else {
      const user = await userRepository.create({
        email:        request.email,
        passwordHash,
        role:         'REGULATOR',
        status:       'ACTIVE',
        regulatorProfile: {
          create: {
            fullName:     request.applicantName,
            phone:        request.phone ?? '',
            organization: request.organization ?? '',
            department:   request.department,
          },
        },
      })
      userId = user.id
    }

    await accessRequestRepository.approve(requestId, performedBy)

    await auditLogRepository.create({
      performedBy,
      entityType: 'ACCESS_REQUEST',
      entityId:   requestId,
      action:     'APPROVED',
      metadata:   { userId, role: request.roleRequested },
    })

    await notificationRepository.create({
      userId,
      type:    'ACCESS_REQUEST_APPROVED',
      title:   'Access Request Approved',
      message: 'Welcome to the NWS Compliance System. Your account is now active.',
    })

    return { ok: true, userId, tempPassword }
  },

  reject: async (performedBy: string, requestId: string, reason: string) => {
    const request = await accessRequestRepository.findById(requestId)
    if (!request) throw new AppError(404, 'Access request not found')
    if (request.status !== 'PENDING') throw new AppError(400, 'Request is not pending')

    await accessRequestRepository.reject(requestId, performedBy, reason)

    await auditLogRepository.create({
      performedBy,
      entityType: 'ACCESS_REQUEST',
      entityId:   requestId,
      action:     'REJECTED',
      metadata:   { reason },
    })

    return { ok: true }
  },

  deactivate: async (performedBy: string, requestId: string) => {
    const request = await accessRequestRepository.findById(requestId)
    if (!request) throw new AppError(404, 'Access request not found')
    if (request.status !== 'APPROVED') throw new AppError(400, 'Only approved requests can be deactivated')

    // Find the user created from this access request by email
    const user = await userRepository.findByEmail(request.email)
    if (!user) throw new AppError(404, 'No user found for this access request')

    // Suspend the user
    await userRepository.updateStatus(user.id, 'SUSPENDED')

    // Mark the access request as deactivated
    await accessRequestRepository.deactivate(requestId, performedBy)

    await auditLogRepository.create({
      performedBy,
      entityType: 'ACCESS_REQUEST',
      entityId:   requestId,
      action:     'DEACTIVATED',
      metadata:   { userId: user.id, email: request.email },
    })

    return { ok: true }
  },

  verifyDocument: async (performedBy: string, requestId: string, verificationStatus: 'VERIFIED' | 'REJECTED') => {
    const request = await accessRequestRepository.findById(requestId)
    if (!request) throw new AppError(404, 'Access request not found')
    if (request.status !== 'PENDING') throw new AppError(400, 'Can only verify documents on pending requests')

    await accessRequestRepository.updateVerificationStatus(requestId, verificationStatus)

    await auditLogRepository.create({
      performedBy,
      entityType: 'ACCESS_REQUEST',
      entityId:   requestId,
      action:     `DOCUMENT_${verificationStatus}`,
      metadata:   { verificationStatus },
    })

    return { ok: true, verificationStatus }
  },
}
