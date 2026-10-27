import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { AppError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { endSession, startSession, type AuthUser } from '../middleware/auth.js';
import { loginSchema, registerSchema } from '../schemas.js';
import { mergeGuestCart } from '../services/cart.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' } },
});

// Compared against when the email is unknown so response time does not reveal which accounts exist.
let dummyHash: Promise<string> | undefined;

authRouter.post('/register', authLimiter, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const passwordHash = await hashPassword(input.password);
  const { rows } = await pool.query<AuthUser>(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id, email, name, role`,
    [input.email, input.name, passwordHash],
  );
  if (!rows[0]) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  await startSession(res, rows[0].id);
  await mergeGuestCart(req, res, rows[0].id);
  res.status(201).json({ user: rows[0] });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const { rows } = await pool.query<AuthUser & { password_hash: string }>(
    'SELECT id, email, name, role, password_hash FROM users WHERE lower(email) = $1',
    [input.email],
  );
  const found = rows[0];
  dummyHash ??= hashPassword('not-a-real-password');
  const ok = await verifyPassword(input.password, found?.password_hash ?? (await dummyHash));
  if (!found || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

  await startSession(res, found.id);
  await mergeGuestCart(req, res, found.id);
  const { password_hash: _omit, ...user } = found;
  res.json({ user });
});

authRouter.post('/logout', async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ?? null });
});
