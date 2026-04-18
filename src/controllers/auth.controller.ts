import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authService } from '../services/auth.service'

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  applicantName:  z.string().min(2),
  email:          z.string().email(),
  phone:          z.string().optional(),
  roleRequested:  z.enum(['CONTRACTOR', 'REGULATOR']),
  contractorCr:   z.string().optional(),
  organization:   z.string().optional(),
  department:     z.string().optional(),
  documentFileId: z.string().uuid().optional(),
  documentName:   z.string().optional(),
})

const updateProfileSchema = z.object({
  fullName:     z.string().min(2).optional(),
  phone:        z.string().optional(),
  companyName:  z.string().min(1).optional(),
  contactName:  z.string().min(2).optional(),
  organization: z.string().optional(),
  department:   z.string().nullable().optional(),
}).strict()

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
})

const forgotPasswordSchema = z.object({ email: z.string().email() })
const verifyOtpSchema = z.object({ email: z.string().email(), otp: z.string().length(6) })
const resetPasswordSchema = z.object({ email: z.string().email(), otp: z.string().length(6), newPassword: z.string().min(8) })

const REFRESH_COOKIE = 'nws_refresh_token'
const isProduction = process.env.NODE_ENV === 'production'

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure:   isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path:     '/api/auth',
    maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days
  })
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
}

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const result = await authService.login(email, password)

    // Set refresh token as httpOnly cookie (web clients)
    setRefreshCookie(res, result.refreshToken)

    const isMobile = req.headers['x-client-type'] === 'mobile'

    // Only include refreshToken in response body for mobile clients.
    // Web clients receive it solely via the httpOnly cookie.
    const { refreshToken, ...body } = result
    res.json(isMobile ? result : body)
  } catch (err) { next(err) }
}

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Accept refresh token from cookie (web) or body (mobile)
    const refreshToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken
    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token provided' })
      return
    }
    const result = await authService.refresh(refreshToken)
    res.json(result)
  } catch (err) { next(err) }
}

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data   = registerSchema.parse(req.body)
    const result = await authService.register(data)
    res.status(201).json(result)
  } catch (err) { next(err) }
}

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.me(req.user!.userId)
    res.json(result)
  } catch (err) { next(err) }
}

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data   = updateProfileSchema.parse(req.body)
    const result = await authService.updateProfile(req.user!.userId, req.user!.role, data)
    res.json(result)
  } catch (err) { next(err) }
}

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body)
    const result = await authService.changePassword(req.user!.userId, currentPassword, newPassword)
    res.json(result)
  } catch (err) { next(err) }
}

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body)
    const result = await authService.forgotPassword(email)
    res.json(result)
  } catch (err) { next(err) }
}

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = verifyOtpSchema.parse(req.body)
    const result = await authService.verifyOtp(data.email, data.otp)
    res.json(result)
  } catch (err) { next(err) }
}

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = resetPasswordSchema.parse(req.body)
    const result = await authService.resetPassword(data.email, data.otp, data.newPassword)
    res.json(result)
  } catch (err) { next(err) }
}
