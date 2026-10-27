import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { pool, type Db } from '../db.js';
import { AppError } from '../lib/errors.js';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'admin';
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const SESSION_COOKIE = 'hibir_sid';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function cookieOptions(maxAgeMs?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.COOKIE_SECURE,
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

export async function startSession(res: Response, userId: number, db: Db = pool) {
  const token = randomBytes(32).toString('base64url');
  const ttlMs = config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  await db.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    userId,
    new Date(Date.now() + ttlMs),
  ]);
  res.cookie(SESSION_COOKIE, token, cookieOptions(ttlMs));
}

export async function endSession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string') await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length > 100) return next();
  const { rows } = await pool.query<AuthUser>(
    `SELECT u.id, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  if (rows[0]) req.user = rows[0];
  next();
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue');
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue');
  if (req.user.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'You do not have access to this area');
  next();
}
