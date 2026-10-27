import { Router } from 'express';
import { pool } from '../db.js';
import { AppError } from '../lib/errors.js';
import { MAX_QUANTITY_PER_LINE } from '../lib/pricing.js';
import { addItemSchema, idParam, setQuantitySchema } from '../schemas.js';
import { getCartView, resolveCartId } from '../services/cart.js';

export const cartRouter = Router();

async function sellableVariant(variantId: number) {
  const { rows } = await pool.query<{ stock: number; available: boolean }>(
    `SELECT v.stock, (v.active AND p.active) AS available
       FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = $1`,
    [variantId],
  );
  const v = rows[0];
  if (!v || !v.available) throw new AppError(404, 'UNAVAILABLE', 'This item is no longer available');
  if (v.stock === 0) throw new AppError(409, 'OUT_OF_STOCK', 'This item is out of stock');
  return v;
}

cartRouter.get('/', async (req, res) => {
  const cartId = await resolveCartId(req, res, false);
  res.json({ cart: await getCartView(cartId) });
});

cartRouter.post('/items', async (req, res) => {
  const input = addItemSchema.parse(req.body);
  const v = await sellableVariant(input.variantId);
  const cartId = (await resolveCartId(req, res, true))!;

  const current = await pool.query<{ quantity: number }>(
    'SELECT quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2',
    [cartId, input.variantId],
  );
  const desired = (current.rows[0]?.quantity ?? 0) + input.quantity;
  if (desired > MAX_QUANTITY_PER_LINE) {
    throw new AppError(409, 'LIMIT_REACHED', `You can order up to ${MAX_QUANTITY_PER_LINE} of each item`);
  }
  if (desired > v.stock) {
    throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${v.stock} left in stock`, { available: v.stock });
  }
  await pool.query(
    `INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = $3`,
    [cartId, input.variantId, desired],
  );
  await pool.query('UPDATE carts SET updated_at = now() WHERE id = $1', [cartId]);
  res.status(201).json({ cart: await getCartView(cartId) });
});

cartRouter.patch('/items/:variantId', async (req, res) => {
  const variantId = idParam.parse(req.params.variantId);
  const { quantity } = setQuantitySchema.parse(req.body);
  const cartId = await resolveCartId(req, res, false);
  if (!cartId) throw new AppError(404, 'NOT_IN_CART', 'This item is not in your bag');
  const v = await sellableVariant(variantId);
  if (quantity > v.stock) {
    throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${v.stock} left in stock`, { available: v.stock });
  }
  const updated = await pool.query('UPDATE cart_items SET quantity = $3 WHERE cart_id = $1 AND variant_id = $2', [
    cartId,
    variantId,
    quantity,
  ]);
  if (updated.rowCount === 0) throw new AppError(404, 'NOT_IN_CART', 'This item is not in your bag');
  res.json({ cart: await getCartView(cartId) });
});

cartRouter.delete('/items/:variantId', async (req, res) => {
  const variantId = idParam.parse(req.params.variantId);
  const cartId = await resolveCartId(req, res, false);
  if (cartId) await pool.query('DELETE FROM cart_items WHERE cart_id = $1 AND variant_id = $2', [cartId, variantId]);
  res.json({ cart: await getCartView(cartId) });
});
