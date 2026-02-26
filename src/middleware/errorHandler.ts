import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import logger from '../config/logger';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Conflict', details: err.meta });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Not found', details: err.meta });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({ error: 'Bad request', details: err.meta });
      return;
    }
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error(message, { stack });

  res.status(500).json({
    error: 'Internal server error',
    message,
    ...(process.env.NODE_ENV === 'development' ? { details: stack } : {}),
  });
};
