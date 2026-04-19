import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { AppError } from '../../middleware/errorHandler'
import { accessRequestRepository } from '../../repositories/accessRequest.repository'
import { userRepository } from '../../repositories/user.repository'
import { contractorRepository } from '../../repositories/contractor.repository'
import { auditLogRepository } from '../../repositories/auditLog.repository'
import { notificationRepository } from '../../repositories/notification.repository'
import { sendTempPasswordEmail } from '../../lib/email'

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

    // For approved requests, look up the current User status by email
    const approvedEmails = items
      .filter((r) => r.status === 'APPROVED')
      .map((r) => r.email)

    let userStatusMap: Record<string, string> = {}
    if (approvedEmails.length > 0) {
      const users = await userRepository.findStatusesByEmails(approvedEmails)
      userStatusMap = Object.fromEntries(users.map((u) => [u.email, u.status]))
    }

    const itemsWithUserStatus = items.map((r) => ({
      ...r,
      userStatus: r.status === 'APPROVED' ? (userStatusMap[r.email] ?? null) : null,
    }))

    return { items: itemsWithUserStatus, total }
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

    const tempPassword = `Temp@${crypto.randomBytes(6).toString('hex').toUpperCase()}`
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
        mustChangePassword: true,
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
    } else if (request.roleRequested === 'INSPECTOR') {
      // Auto-generate employee ID since simple onboarding doesn't collect it
      const employeeId = `EMP-INS-${Date.now().toString().slice(-8)}`
      const user = await userRepository.create({
        email:        request.email,
        passwordHash,
        role:         'INSPECTOR',
        status:       'ACTIVE',
        mustChangePassword: true,
        staffProfile: {
          create: {
            employeeId,
            fullName: request.applicantName,
            phone:    request.phone ?? '',
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
        mustChangePassword: true,
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

    // Email the temp password to the user. If email fails, log but don't fail the approval.
    try {
      await sendTempPasswordEmail(request.email, tempPassword)
    } catch (err) {
      console.error('[APPROVE] Failed to send temp password email to', request.email, err)
    }

    return { ok: true, userId }
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

  reactivate: async (performedBy: string, requestId: string) => {
    const request = await accessRequestRepository.findById(requestId)
    if (!request) throw new AppError(404, 'Access request not found')
    if (request.status !== 'DEACTIVATED') throw new AppError(400, 'Only deactivated requests can be reactivated')

    const user = await userRepository.findByEmail(request.email)
    if (!user) throw new AppError(404, 'No user found for this access request')

    await userRepository.updateStatus(user.id, 'ACTIVE')
    await accessRequestRepository.approve(requestId, performedBy)

    await auditLogRepository.create({
      performedBy,
      entityType: 'ACCESS_REQUEST',
      entityId:   requestId,
      action:     'ACTIVATED',
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
