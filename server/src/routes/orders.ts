import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { notFound } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { checkoutSchema, idParam } from '../schemas.js';
import { getOrder, placeOrder } from '../services/checkout.js';

export const ordersRouter = Router();
ordersRouter.use(requireUser);

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many checkout attempts. Please try again shortly.' } },
});

ordersRouter.post('/', checkoutLimiter, async (req, res) => {
  const input = checkoutSchema.parse(req.body);
  const { orderId, duplicate } = await placeOrder(req.user!.id, input);
  res.status(duplicate ? 200 : 201).json({ order: await getOrder(orderId, req.user!.id), duplicate });
});

ordersRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.id, o.status, o.payment_status AS "paymentStatus", o.total_cents AS "totalCents",
            o.created_at AS "createdAt",
            (SELECT sum(quantity)::int FROM order_items WHERE order_id = o.id) AS "itemCount",
            (SELECT json_agg(t.image_url) FROM (SELECT image_url FROM order_items WHERE order_id = o.id
               AND image_url IS NOT NULL ORDER BY id LIMIT 3) t) AS thumbnails
       FROM orders o WHERE o.user_id = $1
      ORDER BY o.created_at DESC`,
    [req.user!.id],
  );
  res.json({ orders: rows.map((r) => ({ ...r, thumbnails: r.thumbnails ?? [] })) });
});

ordersRouter.get('/:id', async (req, res) => {
  const order = await getOrder(idParam.parse(req.params.id), req.user!.id);
  if (!order) throw notFound('Order');
  res.json({ order });
});
