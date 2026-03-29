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

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const result = await authService.login(email, password)
    res.json(result)
  } catch (err) { next(err) }
}

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)
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
