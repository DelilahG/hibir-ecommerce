import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

// Defence in depth against CSRF on top of SameSite=Lax cookies: state-changing
// requests must be JSON and, when the browser sends an Origin, come from an allowed one.
export function originGuard(allowed: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE.has(req.method)) return next();
    const origin = req.get('origin');
    if (origin && !allowed.includes(origin) && origin !== `${req.protocol}://${req.get('host')}`) {
      throw new AppError(403, 'BAD_ORIGIN', 'Request origin is not allowed');
    }
    const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] !== undefined;
    if (hasBody && !req.is('application/json')) {
      throw new AppError(415, 'UNSUPPORTED_MEDIA', 'Requests must be sent as JSON');
    }
    next();
  };
}
