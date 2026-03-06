import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import logger from '../config/logger';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/errorResponse';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  const req = _req;

  if (err instanceof ZodError) {
    sendError(res, req, 400, 'VALIDATION_FAILED', 'Validation failed', err.flatten());
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      sendError(res, req, 409, 'CONFLICT', 'Conflict', err.meta);
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, req, 404, 'NOT_FOUND', 'Not found', err.meta);
      return;
    }
    if (err.code === 'P2003') {
      sendError(res, req, 400, 'BAD_REQUEST', 'Bad request', err.meta);
      return;
    }
    if (err.code === 'P1000') {
      sendError(res, req, 503, 'DATABASE_AUTH_FAILED', 'Database authentication failed');
      return;
    }
    if (err.code === 'P1001') {
      sendError(res, req, 503, 'DATABASE_UNREACHABLE', 'Database server is unreachable');
      return;
    }
  }

  if (err instanceof AppError) {
    sendError(res, req, err.status, err.code || 'APP_ERROR', err.message, err.details);
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error(message, { stack });

  sendError(
    res,
    req,
    500,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'development' ? message : 'Internal server error',
    process.env.NODE_ENV === 'development' ? stack : undefined
  );
};
