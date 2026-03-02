import { NextFunction, Request, Response } from 'express';

const SENSITIVE_FIELDS = [
  'password',
  'confirmPassword',
  'currentPassword',
  'newPassword',
  'token',
  'secret',
  'creditCard',
  'ssn',
];

function redactSensitive(value: any): any {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const redacted: Record<string, any> = { ...value };
  for (const key of Object.keys(redacted)) {
    if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactSensitive(redacted[key]);
    }
  }
  return redacted;
}

export function sanitizeRequestLogger(req: Request, _res: Response, next: NextFunction) {
  (req as any).sanitizedBody = req.body ? redactSensitive(req.body) : {};
  next();
}
