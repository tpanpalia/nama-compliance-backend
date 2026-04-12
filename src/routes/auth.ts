import crypto from 'crypto'
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as authController from '../controllers/auth.controller'
import { fileService } from '../services/file.service'
import { z } from 'zod'

const router = Router()

// In-memory store for upload tokens (fileId -> token). Entries expire after 10 minutes.
const uploadTokens = new Map<string, { token: string; expiresAt: number }>()

// Cleanup expired tokens periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of uploadTokens) {
    if (value.expiresAt < now) uploadTokens.delete(key)
  }
}, 5 * 60 * 1000).unref()

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
    // Generate a random upload token so only the client that initiated the upload can confirm it
    const uploadToken = crypto.randomBytes(32).toString('hex')
    uploadTokens.set(result.fileId, { token: uploadToken, expiresAt: Date.now() + 10 * 60 * 1000 })
    res.status(201).json({ ...result, uploadToken })
  } catch (err) { next(err) }
})
router.patch('/register/upload/:id/confirm', async (req, res, next) => {
  try {
    // Validate the upload token to prevent unauthorized file confirmation
    const { uploadToken } = req.body ?? {}
    const stored = uploadTokens.get(req.params.id)
    if (!stored || stored.expiresAt < Date.now()) {
      res.status(403).json({ error: 'Invalid or expired upload token' }); return
    }
    if (!uploadToken || uploadToken !== stored.token) {
      res.status(403).json({ error: 'Invalid upload token' }); return
    }

    const { fileRepository } = await import('../repositories/file.repository')
    const file = await fileRepository.findById(req.params.id)
    if (!file) { res.status(404).json({ error: 'File not found' }); return }
    if (file.uploadStatus === 'UPLOADED') {
      uploadTokens.delete(req.params.id)
      res.json({ ok: true, fileId: file.id }); return
    }
    await fileRepository.confirm(file.id)
    uploadTokens.delete(req.params.id)
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
