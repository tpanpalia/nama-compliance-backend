import { NextFunction, Request, Response } from 'express';
import { buildErrorResponse, isApiErrorContract } from '../utils/errorResponse';

function inferMessage(body: any): string {
  if (typeof body?.error === 'string') return body.error;
  if (typeof body?.message === 'string') return body.message;
  return 'Request failed';
}

function inferCode(statusCode: number, body: any): string {
  if (typeof body?.code === 'string' && body.code.trim().length > 0) return body.code;
  if (typeof body?.error === 'string' && body.error.trim().length > 0) {
    return body.error.toUpperCase().replace(/\s+/g, '_');
  }
  return `HTTP_${statusCode}`;
}

export function errorResponseNormalizer(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    if (res.statusCode >= 400) {
      if (isApiErrorContract(body)) {
        return originalJson(body);
      }

      const normalized = buildErrorResponse(
        req,
        res.statusCode,
        inferCode(res.statusCode, body),
        inferMessage(body),
        (body as any)?.details
      );
      return originalJson(normalized);
    }

    return originalJson(body);
  }) as Response['json'];

  next();
}
