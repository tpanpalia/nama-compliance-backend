import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as authController from '../controllers/auth.controller'

const router = Router()

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
