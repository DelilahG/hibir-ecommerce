import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  categoryInput,
  idParam,
  ORDER_STATUSES,
  orderPatch,
  productInput,
  variantPatch,
} from '../schemas.js';
import { getOrder } from '../services/checkout.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const LOW_STOCK = 5;

adminRouter.get('/summary', async (_req, res) => {
  const [orders, revenue, products, lowStock, recent] = await Promise.all([
    pool.query(`SELECT status, count(*)::int AS count FROM orders GROUP BY status`),
    pool.query(
      `SELECT COALESCE(sum(total_cents) FILTER (WHERE payment_status = 'paid'), 0)::int AS "paidCents",
              COALESCE(sum(total_cents) FILTER (WHERE payment_status = 'unpaid' AND status <> 'cancelled'), 0)::int AS "outstandingCents"
         FROM orders`,
    ),
    pool.query(
      `SELECT count(*) FILTER (WHERE active)::int AS active, count(*) FILTER (WHERE NOT active)::int AS inactive FROM products`,
    ),
    pool.query(
      `SELECT v.id, v.sku, v.name AS "variantName", v.stock, p.id AS "productId", p.name AS "productName"
         FROM variants v JOIN products p ON p.id = v.product_id
        WHERE v.active AND p.active AND v.stock <= $1
        ORDER BY v.stock, p.name LIMIT 10`,
      [LOW_STOCK],
    ),
    pool.query(
      `SELECT o.id, o.status, o.payment_status AS "paymentStatus", o.total_cents AS "totalCents",
              o.created_at AS "createdAt", u.name AS "customerName"
         FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 6`,
    ),
  ]);
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  for (const r of orders.rows) byStatus[r.status] = r.count;
  res.json({
    ordersByStatus: byStatus,
    ...revenue.rows[0],
    products: products.rows[0],
    lowStock: lowStock.rows,
    lowStockThreshold: LOW_STOCK,
    recentOrders: recent.rows,
  });
});

// ----- categories -----

const categoryColumns = `id, slug, name, description, image_url AS "imageUrl", image_alt AS "imageAlt",
  position, active, (SELECT count(*)::int FROM products p WHERE p.category_id = categories.id) AS "productCount"`;

adminRouter.get('/categories', async (_req, res) => {
  const { rows } = await pool.query(`SELECT ${categoryColumns} FROM categories ORDER BY position, name`);
  res.json({ categories: rows });
});

adminRouter.post('/categories', async (req, res) => {
  const c = categoryInput.parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO categories (slug, name, description, image_url, image_alt, position, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${categoryColumns}`,
    [c.slug, c.name, c.description, c.imageUrl, c.imageAlt, c.position, c.active],
  );
  res.status(201).json({ category: rows[0] });
});

adminRouter.put('/categories/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const c = categoryInput.parse(req.body);
  const { rows } = await pool.query(
    `UPDATE categories SET slug = $2, name = $3, description = $4, image_url = $5, image_alt = $6,
            position = $7, active = $8
      WHERE id = $1 RETURNING ${categoryColumns}`,
    [id, c.slug, c.name, c.description, c.imageUrl, c.imageAlt, c.position, c.active],
  );
  if (!rows[0]) throw notFound('Category');
  res.json({ category: rows[0] });
});

// ----- products -----

adminRouter.get('/products', async (req, res) => {
  const q = z.object({ q: z.string().trim().max(100).optional() }).parse(req.query);
  const params: unknown[] = [];
  let where = '';
  if (q.q) {
    params.push(`%${q.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where = `WHERE p.name ILIKE $1 OR EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.sku ILIKE $1)`;
  }
  const { rows } = await pool.query(
    `SELECT p.id, p.slug, p.name, p.active, p.featured, c.name AS "categoryName", p.updated_at AS "updatedAt",
            (SELECT url FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS "imageUrl",
            (SELECT min(price_cents) FROM variants WHERE product_id = p.id AND active) AS "minPriceCents",
            (SELECT COALESCE(sum(stock), 0)::int FROM variants WHERE product_id = p.id AND active) AS "totalStock",
            (SELECT count(*)::int FROM variants WHERE product_id = p.id AND active) AS "variantCount"
       FROM products p JOIN categories c ON c.id = p.category_id
       ${where}
      ORDER BY p.active DESC, p.updated_at DESC`,
    params,
  );
  res.json({ products: rows });
});

async function loadAdminProduct(id: number) {
  const { rows } = await pool.query(
    `SELECT p.id, p.slug, p.name, p.description, p.details, p.category_id AS "categoryId", p.active, p.featured,
            COALESCE((SELECT json_agg(json_build_object('url', url, 'alt', alt, 'creditName', credit_name,
                      'creditUrl', credit_url) ORDER BY position, id) FROM product_images WHERE product_id = p.id), '[]'::json) AS images,
            COALESCE((SELECT json_agg(json_build_object('id', id, 'sku', sku, 'name', name, 'priceCents', price_cents,
                      'stock', stock, 'active', active) ORDER BY active DESC, position, id) FROM variants WHERE product_id = p.id), '[]'::json) AS variants
       FROM products p WHERE p.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

adminRouter.get('/products/:id', async (req, res) => {
  const product = await loadAdminProduct(idParam.parse(req.params.id));
  if (!product) throw notFound('Product');
  res.json({ product });
});

type ProductInput = z.infer<typeof productInput>;

async function writeChildren(client: pg.PoolClient, productId: number, p: ProductInput) {
  await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
  for (const [i, img] of p.images.entries()) {
    await client.query(
      `INSERT INTO product_images (product_id, url, alt, credit_name, credit_url, position) VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, img.url, img.alt, img.creditName, img.creditUrl, i],
    );
  }

  // Variants are never deleted because past orders reference them; omitted ones are deactivated.
  const keep: number[] = [];
  for (const [i, v] of p.variants.entries()) {
    if (v.id) {
      const r = await client.query(
        `UPDATE variants SET sku = $3, name = $4, price_cents = $5, stock = $6, active = $7, position = $8
          WHERE id = $1 AND product_id = $2 RETURNING id`,
        [v.id, productId, v.sku, v.name, v.priceCents, v.stock, v.active, i],
      );
      if (!r.rows[0]) throw new AppError(400, 'BAD_VARIANT', `Variant ${v.id} does not belong to this product`);
      keep.push(v.id);
    } else {
      const r = await client.query<{ id: number }>(
        `INSERT INTO variants (product_id, sku, name, price_cents, stock, active, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [productId, v.sku, v.name, v.priceCents, v.stock, v.active, i],
      );
      keep.push(r.rows[0].id);
    }
  }
  await client.query('UPDATE variants SET active = false WHERE product_id = $1 AND NOT (id = ANY($2::bigint[]))', [
    productId,
    keep,
  ]);
}

async function assertCategory(client: pg.PoolClient, id: number) {
  const r = await client.query('SELECT 1 FROM categories WHERE id = $1', [id]);
  if (!r.rows[0]) throw new AppError(400, 'BAD_CATEGORY', 'Choose an existing category');
}

adminRouter.post('/products', async (req, res) => {
  const p = productInput.parse(req.body);
  const id = await withTransaction(async (client) => {
    await assertCategory(client, p.categoryId);
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO products (slug, name, description, details, category_id, active, featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [p.slug, p.name, p.description, p.details, p.categoryId, p.active, p.featured],
    );
    await writeChildren(client, rows[0].id, p);
    return rows[0].id;
  });
  res.status(201).json({ product: await loadAdminProduct(id) });
});

adminRouter.put('/products/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const p = productInput.parse(req.body);
  await withTransaction(async (client) => {
    await assertCategory(client, p.categoryId);
    const r = await client.query(
      `UPDATE products SET slug = $2, name = $3, description = $4, details = $5, category_id = $6,
              active = $7, featured = $8, updated_at = now()
        WHERE id = $1 RETURNING id`,
      [id, p.slug, p.name, p.description, p.details, p.categoryId, p.active, p.featured],
    );
    if (!r.rows[0]) throw notFound('Product');
    await writeChildren(client, id, p);
  });
  res.json({ product: await loadAdminProduct(id) });
});

adminRouter.patch('/products/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const patch = z
    .object({ active: z.boolean().optional(), featured: z.boolean().optional() })
    .refine((v) => v.active !== undefined || v.featured !== undefined, 'Nothing to update')
    .parse(req.body);
  const { rows } = await pool.query(
    `UPDATE products SET active = COALESCE($2, active), featured = COALESCE($3, featured), updated_at = now()
      WHERE id = $1 RETURNING id, active, featured`,
    [id, patch.active ?? null, patch.featured ?? null],
  );
  if (!rows[0]) throw notFound('Product');
  res.json({ product: rows[0] });
});

adminRouter.patch('/variants/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const patch = variantPatch.parse(req.body);
  const { rows } = await pool.query(
    `UPDATE variants SET stock = COALESCE($2, stock), price_cents = COALESCE($3, price_cents),
            active = COALESCE($4, active)
      WHERE id = $1
      RETURNING id, sku, name, stock, price_cents AS "priceCents", active`,
    [id, patch.stock ?? null, patch.priceCents ?? null, patch.active ?? null],
  );
  if (!rows[0]) throw notFound('Variant');
  res.json({ variant: rows[0] });
});

// ----- orders -----

const TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

adminRouter.get('/orders', async (req, res) => {
  const q = z
    .object({
      status: z.enum(ORDER_STATUSES).optional(),
      page: z.coerce.number().int().min(1).default(1),
    })
    .parse(req.query);
  const limit = 20;
  const params: unknown[] = [];
  let where = '';
  if (q.status) {
    params.push(q.status);
    where = 'WHERE o.status = $1';
  }
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT o.id, o.status, o.payment_status AS "paymentStatus", o.total_cents AS "totalCents",
              o.created_at AS "createdAt", u.name AS "customerName", u.email AS "customerEmail",
              (SELECT sum(quantity)::int FROM order_items WHERE order_id = o.id) AS "itemCount"
         FROM orders o JOIN users u ON u.id = o.user_id ${where}
        ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${(q.page - 1) * limit}`,
      params,
    ),
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM orders o ${where}`, params),
  ]);
  res.json({ orders: list.rows, page: q.page, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) });
});

adminRouter.get('/orders/:id', async (req, res) => {
  const order = await getOrder(idParam.parse(req.params.id));
  if (!order) throw notFound('Order');
  res.json({ order, nextStatuses: TRANSITIONS[order.status] });
});

adminRouter.patch('/orders/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const patch = orderPatch.parse(req.body);
  await withTransaction(async (client) => {
    const { rows } = await client.query<{ status: string }>('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw notFound('Order');
    const current = rows[0].status;

    if (patch.status && patch.status !== current) {
      if (!TRANSITIONS[current].includes(patch.status)) {
        throw new AppError(409, 'BAD_TRANSITION', `An order that is ${current} cannot be marked ${patch.status}`);
      }
      if (patch.status === 'cancelled') {
        // Return reserved stock to inventory.
        await client.query(
          `UPDATE variants v SET stock = v.stock + i.quantity
             FROM order_items i WHERE i.order_id = $1 AND i.variant_id = v.id`,
          [id],
        );
      }
      await client.query('UPDATE orders SET status = $2, updated_at = now() WHERE id = $1', [id, patch.status]);
    }
    if (patch.paymentStatus) {
      await client.query('UPDATE orders SET payment_status = $2, updated_at = now() WHERE id = $1', [
        id,
        patch.paymentStatus,
      ]);
    }
  });
  const order = await getOrder(id);
  res.json({ order, nextStatuses: TRANSITIONS[order.status] });
});
