import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    })
    return
  }

  // Application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  // Prisma unique constraint violation
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'A record with this value already exists' })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Record not found' })
      return
    }
  }

  // Unknown errors
  console.error('[Unhandled error]', err)
  res.status(500).json({ error: 'Internal server error' })
}
