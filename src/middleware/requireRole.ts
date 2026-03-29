import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' })
      return
    }
    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({ error: 'Forbidden: insufficient role' })
      return
    }
    next()
  }
}
