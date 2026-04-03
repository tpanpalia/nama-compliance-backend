import bcrypt from 'bcryptjs'
import { AppError } from '../middleware/errorHandler'
import { userRepository } from '../repositories/user.repository'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt'
import { generateRequestId } from '../utils/ids'
import { accessRequestRepository } from '../repositories/accessRequest.repository'
import { prisma } from '../lib/prisma'
import { sendOtpEmail } from '../lib/email'

export const authService = {
  login: async (email: string, password: string) => {
    const user = await userRepository.findByEmail(email.toLowerCase())
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'Invalid email or password')
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError(403, `Account is ${user.status.toLowerCase()}. Contact administrator.`)
    }

    await userRepository.updateLastLogin(user.id)

    const payload      = { userId: user.id, role: user.role, email: user.email }
    const accessToken  = signAccessToken(payload)
    const refreshToken = signRefreshToken({ userId: user.id })

    const profile = user.contractorProfile ?? user.staffProfile ?? user.regulatorProfile ?? null

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, status: user.status, profile },
    }
  },

  refresh: async (refreshToken: string) => {
    const decoded = verifyRefreshToken(refreshToken)
    const user    = await userRepository.findById(decoded.userId)
    if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'Invalid refresh token')

    const accessToken = signAccessToken({ userId: user.id, role: user.role, email: user.email })
    return { accessToken }
  },

  register: async (data: {
    applicantName: string
    email: string
    phone?: string
    roleRequested: 'CONTRACTOR' | 'REGULATOR'
    contractorCr?: string
    organization?: string
    department?: string
    documentFileId?: string
    documentName?: string
  }) => {
    if (data.roleRequested === 'CONTRACTOR' && !data.contractorCr) {
      throw new AppError(400, 'CR Number is required for contractor registration')
    }
    if (data.roleRequested === 'REGULATOR' && !data.organization) {
      throw new AppError(400, 'Organization is required for regulator registration')
    }

    const existing = await accessRequestRepository.findPendingByEmail(data.email.toLowerCase())
    if (existing) throw new AppError(409, 'A pending request already exists for this email')

    const id = await generateRequestId()
    const request = await accessRequestRepository.create({
      id,
      applicantName:  data.applicantName,
      email:          data.email.toLowerCase(),
      phone:          data.phone,
      roleRequested:  data.roleRequested,
      contractorCr:   data.contractorCr,
      organization:   data.organization,
      department:     data.department,
      documentFileId: data.documentFileId,
      documentName:   data.documentName,
    })

    return { requestId: request.id, message: 'Request submitted. You will be notified once reviewed.' }
  },

  me: async (userId: string) => {
    const user = await userRepository.findById(userId)
    if (!user) throw new AppError(404, 'User not found')
    const { passwordHash: _, ...safeUser } = user
    return safeUser
  },

  updateProfile: async (userId: string, role: string, data: {
    fullName?:    string
    phone?:       string
    companyName?: string
    contactName?: string
    organization?: string
    department?:  string | null
  }) => {
    if (role === 'INSPECTOR' || role === 'ADMIN') {
      await userRepository.updateStaffProfile(userId, {
        ...(data.fullName ? { fullName: data.fullName } : {}),
        ...(data.phone    ? { phone:    data.phone }    : {}),
      })
    } else if (role === 'REGULATOR') {
      await userRepository.updateRegulatorProfile(userId, {
        ...(data.fullName     ? { fullName:     data.fullName }     : {}),
        ...(data.phone        ? { phone:        data.phone }        : {}),
        ...(data.organization ? { organization: data.organization } : {}),
        ...('department' in data ? { department: data.department }  : {}),
      })
    } else if (role === 'CONTRACTOR') {
      await userRepository.updateContractorProfile(userId, {
        ...(data.companyName ? { companyName: data.companyName } : {}),
        ...(data.contactName ? { contactName: data.contactName } : {}),
        ...(data.phone       ? { phone:       data.phone }       : {}),
      })
    }

    return authService.me(userId)
  },

  changePassword: async (userId: string, currentPassword: string, newPassword: string) => {
    const user = await userRepository.findById(userId)
    if (!user) throw new AppError(404, 'User not found')
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError(400, 'Current password is incorrect')
    }
    const hash = await bcrypt.hash(newPassword, 12)
    await userRepository.updatePassword(userId, hash)
    return { message: 'Password updated' }
  },

  forgotPassword: async (email: string) => {
    const user = await userRepository.findByEmail(email.toLowerCase())
    if (!user) return { ok: true } // Don't reveal if email exists

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Invalidate previous OTPs for this email
    await prisma.passwordResetOtp.updateMany({
      where: { email: email.toLowerCase(), used: false },
      data: { used: true },
    })

    // Store new OTP
    await prisma.passwordResetOtp.create({
      data: { email: email.toLowerCase(), otp, expiresAt },
    })

    // Send email
    await sendOtpEmail(email.toLowerCase(), otp)

    return { ok: true }
  },

  verifyOtp: async (email: string, otp: string) => {
    const record = await prisma.passwordResetOtp.findFirst({
      where: { email: email.toLowerCase(), otp, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) throw new AppError(400, 'Invalid or expired OTP')
    return { ok: true, valid: true }
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    const record = await prisma.passwordResetOtp.findFirst({
      where: { email: email.toLowerCase(), otp, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) throw new AppError(400, 'Invalid or expired OTP')

    const user = await userRepository.findByEmail(email.toLowerCase())
    if (!user) throw new AppError(404, 'User not found')

    const hash = await bcrypt.hash(newPassword, 12)
    await userRepository.updatePassword(user.id, hash)

    // Mark OTP as used
    await prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { used: true },
    })

    return { ok: true }
  },
}
