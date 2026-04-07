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

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = verifyAccessToken(token)

    // Validate tokenVersion against the database to support revocation
    prisma.user.findUnique({ where: { id: payload.userId }, select: { tokenVersion: true } })
      .then((user) => {
        if (!user || user.tokenVersion !== payload.tokenVersion) {
          res.status(401).json({ error: 'Token has been revoked' })
          return
        }
        req.user = payload
        next()
      })
      .catch(() => {
        res.status(401).json({ error: 'Invalid or expired token' })
      })
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
