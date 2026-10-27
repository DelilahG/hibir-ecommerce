import type { Request, Response } from 'express';
import { z } from 'zod';
import { pool, type Db } from '../db.js';
import { cookieOptions } from '../middleware/auth.js';
import { calculateTotals, MAX_QUANTITY_PER_LINE } from '../lib/pricing.js';

export const CART_COOKIE = 'hibir_cart';
const CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const uuid = z.uuid();

async function userCartId(userId: number, db: Db): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO carts (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [userId],
  );
  return rows[0].id;
}

function guestCookie(req: Request): string | null {
  const raw = req.cookies?.[CART_COOKIE];
  return uuid.safeParse(raw).success ? (raw as string) : null;
}

/** Resolves the cart for the current visitor. Guest carts live behind an httpOnly cookie. */
export async function resolveCartId(req: Request, res: Response, create: boolean): Promise<string | null> {
  if (req.user) return userCartId(req.user.id, pool);
  const fromCookie = guestCookie(req);
  if (fromCookie) {
    const { rows } = await pool.query('SELECT id FROM carts WHERE id = $1 AND user_id IS NULL', [fromCookie]);
    if (rows[0]) return fromCookie;
  }
  if (!create) return null;
  const { rows } = await pool.query<{ id: string }>('INSERT INTO carts DEFAULT VALUES RETURNING id');
  res.cookie(CART_COOKIE, rows[0].id, cookieOptions(CART_TTL_MS));
  return rows[0].id;
}

/** Moves a guest cart's lines into the user's cart after sign-in. */
export async function mergeGuestCart(req: Request, res: Response, userId: number) {
  const guestId = guestCookie(req);
  res.clearCookie(CART_COOKIE, cookieOptions());
  if (!guestId) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const guest = await client.query('SELECT id FROM carts WHERE id = $1 AND user_id IS NULL FOR UPDATE', [guestId]);
    if (guest.rows[0]) {
      const targetId = await userCartId(userId, client);
      await client.query(
        `INSERT INTO cart_items (cart_id, variant_id, quantity)
         SELECT $1, variant_id, quantity FROM cart_items WHERE cart_id = $2
         ON CONFLICT (cart_id, variant_id)
         DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, $3)`,
        [targetId, guestId, MAX_QUANTITY_PER_LINE],
      );
      await client.query('DELETE FROM carts WHERE id = $1', [guestId]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface CartLine {
  variantId: number;
  productId: number;
  slug: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  imageAlt: string;
  unitPriceCents: number;
  quantity: number;
  stock: number;
  available: boolean;
  issue: 'unavailable' | 'insufficient_stock' | null;
}

export function emptyCart() {
  return { items: [] as CartLine[], itemCount: 0, hasIssues: false, ...calculateTotals([]) };
}

export async function getCartView(cartId: string | null) {
  if (!cartId) return emptyCart();
  const { rows } = await pool.query<Omit<CartLine, 'issue'>>(
    `SELECT v.id AS "variantId", p.id AS "productId", p.slug, p.name AS "productName",
            v.name AS "variantName", v.sku, v.price_cents AS "unitPriceCents", ci.quantity, v.stock,
            (v.active AND p.active) AS available,
            img.url AS "imageUrl", COALESCE(img.alt, p.name) AS "imageAlt"
       FROM cart_items ci
       JOIN variants v ON v.id = ci.variant_id
       JOIN products p ON p.id = v.product_id
       LEFT JOIN LATERAL (
         SELECT url, alt FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1
       ) img ON true
      WHERE ci.cart_id = $1
      ORDER BY ci.added_at, v.id`,
    [cartId],
  );
  const items: CartLine[] = rows.map((r) => ({
    ...r,
    issue: !r.available ? 'unavailable' : r.stock < r.quantity ? 'insufficient_stock' : null,
  }));
  const purchasable = items.filter((i) => i.issue === null);
  return {
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    hasIssues: items.some((i) => i.issue !== null),
    ...calculateTotals(purchasable),
  };
}
