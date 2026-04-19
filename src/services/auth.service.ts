import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { AppError } from '../middleware/errorHandler'
import { userRepository } from '../repositories/user.repository'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt'
import { generateRequestId } from '../utils/ids'
import { accessRequestRepository } from '../repositories/accessRequest.repository'
import { prisma } from '../lib/prisma'
import { sendOtpEmail } from '../lib/email'
import { invalidateTokenCache } from '../middleware/auth'

// ── Per-email OTP brute-force protection ────────────────────────
const OTP_MAX_ATTEMPTS = 5
const OTP_LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes
const otpFailures = new Map<string, { attempts: number; lockedUntil: number | null }>()

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of otpFailures) {
    if (val.lockedUntil && val.lockedUntil < now) otpFailures.delete(key)
  }
}, 10 * 60 * 1000).unref()

function checkOtpLockout(email: string): void {
  const entry = otpFailures.get(email)
  if (!entry) return
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((entry.lockedUntil - Date.now()) / 60000)
    throw new AppError(423, `Too many failed OTP attempts. Try again in ${minutesLeft} minute(s).`)
  }
}

function recordOtpFailure(email: string): void {
  const entry = otpFailures.get(email) ?? { attempts: 0, lockedUntil: null }
  entry.attempts += 1
  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + OTP_LOCKOUT_MS
    // Also invalidate the OTP so it can't be retried after lockout
    prisma.passwordResetOtp.updateMany({
      where: { email, used: false },
      data: { used: true },
    }).catch(() => {})
  }
  otpFailures.set(email, entry)
}

function clearOtpFailures(email: string): void {
  otpFailures.delete(email)
}

export const authService = {
  login: async (email: string, password: string) => {
    const MAX_ATTEMPTS = 5
    const LOCKOUT_MINUTES = 15

    const user = await userRepository.findByEmail(email.toLowerCase())
    if (!user) throw new AppError(401, 'Invalid email or password')

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      throw new AppError(423, `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`)
    }

    // Check password
    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      const attempts = (user.failedLoginAttempts || 0) + 1
      const lockout = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, lockedUntil: lockout },
      })
      if (lockout) {
        throw new AppError(423, `Account locked after ${MAX_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`)
      }
      throw new AppError(401, `Invalid email or password. ${MAX_ATTEMPTS - attempts} attempt(s) remaining.`)
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError(403, `Account is ${user.status.toLowerCase()}. Contact administrator.`)
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      })
    }

    await userRepository.updateLastLogin(user.id)

    const payload      = { userId: user.id, role: user.role, email: user.email, tokenVersion: user.tokenVersion }
    const accessToken  = signAccessToken(payload)
    const refreshToken = signRefreshToken({ userId: user.id, tokenVersion: user.tokenVersion })

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

    // Reject refresh tokens issued before a password change/reset
    if (decoded.tokenVersion !== user.tokenVersion) {
      throw new AppError(401, 'Token has been revoked. Please log in again.')
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role, email: user.email, tokenVersion: user.tokenVersion })
    return { accessToken }
  },

  register: async (data: {
    applicantName: string
    email: string
    phone?: string
    roleRequested: 'CONTRACTOR' | 'REGULATOR' | 'INSPECTOR'
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
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, tokenVersion: { increment: 1 } },
    })
    invalidateTokenCache(userId)
    return { message: 'Password updated' }
  },

  forgotPassword: async (email: string) => {
    const user = await userRepository.findByEmail(email.toLowerCase())
    if (!user) return { ok: true } // Don't reveal if email exists

    // Rate limit: max 3 OTPs per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentCount = await prisma.passwordResetOtp.count({
      where: { email: email.toLowerCase(), createdAt: { gt: oneHourAgo } },
    })
    if (recentCount >= 3) throw new AppError(429, 'Too many OTP requests. Please try again later.')

    // Generate 6-digit OTP
    const otp = String(crypto.randomInt(100000, 1000000))
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
    checkOtpLockout(email.toLowerCase())

    const record = await prisma.passwordResetOtp.findFirst({
      where: { email: email.toLowerCase(), otp, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) {
      recordOtpFailure(email.toLowerCase())
      throw new AppError(400, 'Invalid or expired OTP')
    }
    clearOtpFailures(email.toLowerCase())
    return { ok: true, valid: true }
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    checkOtpLockout(email.toLowerCase())

    const record = await prisma.passwordResetOtp.findFirst({
      where: { email: email.toLowerCase(), otp, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) {
      recordOtpFailure(email.toLowerCase())
      throw new AppError(400, 'Invalid or expired OTP')
    }
    clearOtpFailures(email.toLowerCase())

    const user = await userRepository.findByEmail(email.toLowerCase())
    if (!user) throw new AppError(404, 'User not found')

    const hash = await bcrypt.hash(newPassword, 12)

    // Update password and increment tokenVersion to invalidate all existing tokens
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, tokenVersion: { increment: 1 } },
    })
    invalidateTokenCache(user.id)

    // Mark OTP as used
    await prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { used: true },
    })

    return { ok: true }
  },
}
