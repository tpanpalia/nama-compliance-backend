import { Request, Response } from 'express';

export interface ApiErrorContract {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    timestamp: string;
    path: string;
  };
}

export function buildErrorResponse(
  req: Request,
  status: number,
  code: string,
  message: string,
  details?: unknown
): ApiErrorContract {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
      path: req.originalUrl || req.url,
    },
  };
}

export function sendError(
  res: Response,
  req: Request,
  status: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  return res.status(status).json(buildErrorResponse(req, status, code, message, details));
}

export function isApiErrorContract(payload: unknown): payload is ApiErrorContract {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as any;
  return p.success === false && p.error && typeof p.error === 'object' && typeof p.error.message === 'string';
}
