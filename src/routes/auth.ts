import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as authController from '../controllers/auth.controller'
import { fileService } from '../services/file.service'
import { z } from 'zod'

const router = Router()

// Public document upload for registration (no auth required)
const regDocSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive().optional(),
})
router.post('/register/upload', async (req, res, next) => {
  try {
    const data = regDocSchema.parse(req.body)
    const result = await fileService.presign('system', {
      filename: data.filename,
      mimeType: data.mimeType,
      category: 'ACCESS_REQUEST_DOC',
      fileSize: data.fileSize,
    })
    res.status(201).json(result)
  } catch (err) { next(err) }
})
router.patch('/register/upload/:id/confirm', async (req, res, next) => {
  try {
    // For public registration uploads, skip user ownership check
    const { fileRepository } = await import('../repositories/file.repository')
    const file = await fileRepository.findById(req.params.id)
    if (!file) { res.status(404).json({ error: 'File not found' }); return }
    if (file.uploadStatus === 'UPLOADED') { res.json({ ok: true, fileId: file.id }); return }
    await fileRepository.confirm(file.id)
    res.json({ ok: true, fileId: file.id })
  } catch (err) { next(err) }
})

router.post('/login',            authController.login)
router.post('/refresh',          authController.refresh)
router.post('/register',         authController.register)
router.post('/forgot-password',  authController.forgotPassword)
router.post('/verify-otp',       authController.verifyOtp)
router.post('/reset-password',   authController.resetPassword)
router.get('/me',             authenticate, authController.me)
router.patch('/me/profile',  authenticate, authController.updateProfile)
router.patch('/me/password', authenticate, authController.changePassword)

export default router
