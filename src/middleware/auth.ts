import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, JwtPayload } from '../lib/jwt'
import { prisma } from '../lib/prisma'

// Extend Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

// In-memory cache for tokenVersion checks (avoids DB hit on every request)
// Key: userId, Value: { tokenVersion, status, expiresAt }
const tokenVersionCache = new Map<string, { tokenVersion: number; status: string; expiresAt: number }>()
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

async function validateTokenVersion(userId: string, tokenVersion: number): Promise<{ valid: boolean; reason?: string }> {
  const now = Date.now()
  const cached = tokenVersionCache.get(userId)

  if (cached && cached.expiresAt > now) {
    if (cached.status !== 'ACTIVE') return { valid: false, reason: 'Account inactive or not found' }
    if (cached.tokenVersion !== tokenVersion) return { valid: false, reason: 'Token has been revoked' }
    return { valid: true }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true, status: true },
  })

  if (!user || user.status !== 'ACTIVE') {
    tokenVersionCache.delete(userId)
    return { valid: false, reason: 'Account inactive or not found' }
  }

  tokenVersionCache.set(userId, {
    tokenVersion: user.tokenVersion,
    status: user.status,
    expiresAt: now + CACHE_TTL_MS,
  })

  if (user.tokenVersion !== tokenVersion) {
    return { valid: false, reason: 'Token has been revoked' }
  }

  return { valid: true }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = verifyAccessToken(token)

    validateTokenVersion(payload.userId, payload.tokenVersion)
      .then((result) => {
        if (!result.valid) {
          res.status(401).json({ error: result.reason })
          return
        }
        req.user = payload
        next()
      })
      .catch(() => {
        res.status(500).json({ error: 'Authentication check failed' })
      })
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/** Clear the tokenVersion cache for a user (call after password change/reset) */
export function invalidateTokenCache(userId: string): void {
  tokenVersionCache.delete(userId)
}
