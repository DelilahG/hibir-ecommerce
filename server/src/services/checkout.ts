import type pg from 'pg';
import { pool } from '../db.js';
import { AppError } from '../lib/errors.js';
import { calculateTotals } from '../lib/pricing.js';

export interface ShippingAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  phone: string;
}

interface LockedVariant {
  id: number;
  productId: number;
  productName: string;
  variantName: string;
  sku: string;
  priceCents: number;
  stock: number;
  available: boolean;
  imageUrl: string | null;
}

async function findExisting(db: pg.Pool | pg.PoolClient, userId: number, key: string) {
  const { rows } = await db.query<{ id: number }>(
    'SELECT id FROM orders WHERE user_id = $1 AND idempotency_key = $2',
    [userId, key],
  );
  return rows[0]?.id ?? null;
}

/**
 * Turns the user's cart into an order. Prices come from the database, stock rows are
 * locked for the duration of the transaction, and the idempotency key makes retries safe.
 */
export async function placeOrder(
  userId: number,
  input: { idempotencyKey: string; address: ShippingAddress; notes: string },
): Promise<{ orderId: number; duplicate: boolean }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await findExisting(client, userId, input.idempotencyKey);
    if (existing) {
      await client.query('ROLLBACK');
      return { orderId: existing, duplicate: true };
    }

    // Locking the cart row serialises concurrent checkouts by the same user.
    const cart = await client.query<{ id: string }>('SELECT id FROM carts WHERE user_id = $1 FOR UPDATE', [userId]);
    const cartId = cart.rows[0]?.id;
    const lines = cartId
      ? (
          await client.query<{ variantId: number; quantity: number }>(
            'SELECT variant_id AS "variantId", quantity FROM cart_items WHERE cart_id = $1',
            [cartId],
          )
        ).rows
      : [];

    if (lines.length === 0) {
      // A concurrent duplicate may have just emptied the cart; prefer returning that order.
      const raced = await findExisting(client, userId, input.idempotencyKey);
      await client.query('ROLLBACK');
      if (raced) return { orderId: raced, duplicate: true };
      throw new AppError(400, 'CART_EMPTY', 'Your bag is empty');
    }

    const { rows: variants } = await client.query<LockedVariant>(
      `SELECT v.id, p.id AS "productId", p.name AS "productName", v.name AS "variantName", v.sku,
              v.price_cents AS "priceCents", v.stock, (v.active AND p.active) AS available,
              (SELECT url FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS "imageUrl"
         FROM variants v JOIN products p ON p.id = v.product_id
        WHERE v.id = ANY($1::bigint[])
        ORDER BY v.id
        FOR UPDATE OF v`,
      [lines.map((l) => l.variantId)],
    );
    const byId = new Map(variants.map((v) => [v.id, v]));

    const problems = lines.flatMap((line) => {
      const v = byId.get(line.variantId);
      if (!v || !v.available) return [{ variantId: line.variantId, reason: 'unavailable', available: 0 }];
      if (v.stock < line.quantity) return [{ variantId: line.variantId, reason: 'insufficient_stock', available: v.stock }];
      return [];
    });
    if (problems.length > 0) {
      throw new AppError(409, 'STOCK_CHANGED', 'Some items in your bag are no longer available in that quantity', problems);
    }

    const priced = lines.map((line) => {
      const v = byId.get(line.variantId)!;
      return { v, quantity: line.quantity, unitPriceCents: v.priceCents };
    });
    const totals = calculateTotals(priced);
    const a = input.address;

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO orders (user_id, idempotency_key, subtotal_cents, shipping_cents, total_cents,
                           ship_name, ship_line1, ship_line2, ship_city, ship_region, ship_postal,
                           ship_country, ship_phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (user_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [
        userId, input.idempotencyKey, totals.subtotalCents, totals.shippingCents, totals.totalCents,
        a.name, a.line1, a.line2, a.city, a.region, a.postal, a.country, a.phone, input.notes,
      ],
    );
    if (!inserted.rows[0]) {
      await client.query('ROLLBACK');
      return { orderId: (await findExisting(pool, userId, input.idempotencyKey))!, duplicate: true };
    }
    const orderId = inserted.rows[0].id;

    for (const line of priced) {
      await client.query(
        `INSERT INTO order_items (order_id, variant_id, product_id, product_name, variant_name, sku, image_url,
                                  unit_price_cents, quantity, line_total_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          orderId, line.v.id, line.v.productId, line.v.productName, line.v.variantName, line.v.sku,
          line.v.imageUrl, line.unitPriceCents, line.quantity, line.unitPriceCents * line.quantity,
        ],
      );
      await client.query('UPDATE variants SET stock = stock - $2 WHERE id = $1', [line.v.id, line.quantity]);
    }
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    await client.query('COMMIT');
    return { orderId, duplicate: false };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function getOrder(orderId: number, userId?: number) {
  const params: unknown[] = [orderId];
  let where = 'o.id = $1';
  if (userId !== undefined) {
    params.push(userId);
    where += ' AND o.user_id = $2';
  }
  const { rows } = await pool.query(
    `SELECT o.id, o.status, o.payment_status AS "paymentStatus", o.payment_method AS "paymentMethod",
            o.subtotal_cents AS "subtotalCents", o.shipping_cents AS "shippingCents", o.total_cents AS "totalCents",
            json_build_object('name', o.ship_name, 'line1', o.ship_line1, 'line2', o.ship_line2,
              'city', o.ship_city, 'region', o.ship_region, 'postal', o.ship_postal,
              'country', o.ship_country, 'phone', o.ship_phone) AS address,
            o.notes, o.created_at AS "createdAt", o.updated_at AS "updatedAt",
            json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS customer,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', i.id, 'variantId', i.variant_id, 'productName', i.product_name,
                'variantName', i.variant_name, 'sku', i.sku, 'imageUrl', i.image_url,
                'unitPriceCents', i.unit_price_cents, 'quantity', i.quantity,
                'lineTotalCents', i.line_total_cents, 'slug', p.slug) ORDER BY i.id)
                FROM order_items i LEFT JOIN products p ON p.id = i.product_id
               WHERE i.order_id = o.id), '[]'::json) AS items
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE ${where}`,
    params,
  );
  return rows[0] ?? null;
}
