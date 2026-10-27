import { Router } from 'express';
import { pool } from '../db.js';
import { notFound } from '../lib/errors.js';
import { catalogQuery } from '../schemas.js';

export const catalogRouter = Router();

catalogRouter.get('/categories', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.slug, c.name, c.description, c.image_url AS "imageUrl", c.image_alt AS "imageAlt",
            c.image_credit AS "imageCredit", c.image_credit_url AS "imageCreditUrl",
            (SELECT count(*)::int FROM products p WHERE p.category_id = c.id AND p.active) AS "productCount"
       FROM categories c
      WHERE c.active
      ORDER BY c.position, c.name`,
  );
  res.json({ categories: rows });
});

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'agg.min_price ASC, p.id',
  price_desc: 'agg.min_price DESC, p.id',
  name: 'p.name ASC',
} as const;

catalogRouter.get('/products', async (req, res) => {
  const q = catalogQuery.parse(req.query);
  const where = ['p.active', 'c.active', 'agg.min_price IS NOT NULL'];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (q.q) {
    const term = add(`%${q.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where.push(`(p.name ILIKE ${term} OR p.description ILIKE ${term} OR c.name ILIKE ${term})`);
  }
  if (q.category) where.push(`c.slug = ${add(q.category)}`);
  if (q.minPrice !== undefined) where.push(`agg.min_price >= ${add(q.minPrice)}`);
  if (q.maxPrice !== undefined) where.push(`agg.min_price <= ${add(q.maxPrice)}`);
  if (q.inStock) where.push('agg.total_stock > 0');
  if (q.featured) where.push('p.featured');

  const from = `
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN LATERAL (
      SELECT min(v.price_cents) AS min_price, max(v.price_cents) AS max_price, sum(v.stock)::int AS total_stock,
             count(*)::int AS variant_count
        FROM variants v WHERE v.product_id = p.id AND v.active
    ) agg ON true
    WHERE ${where.join(' AND ')}`;

  const countParams = [...params];
  const limit = add(q.limit);
  const offset = add((q.page - 1) * q.limit);

  const [list, count] = await Promise.all([
    pool.query(
      `SELECT p.id, p.slug, p.name, p.featured, p.created_at AS "createdAt",
              json_build_object('slug', c.slug, 'name', c.name) AS category,
              agg.min_price AS "minPriceCents", agg.max_price AS "maxPriceCents",
              agg.total_stock AS "totalStock", agg.variant_count AS "variantCount",
              (SELECT json_agg(json_build_object('url', i.url, 'alt', i.alt) ORDER BY i.position, i.id)
                 FROM (SELECT * FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 2) i) AS images,
              (SELECT v.id FROM variants v WHERE v.product_id = p.id AND v.active AND v.stock > 0
                ORDER BY v.position, v.id LIMIT 1) AS "defaultVariantId"
       ${from}
       ORDER BY ${SORTS[q.sort]}
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: number }>(`SELECT count(*)::int AS total ${from}`, countParams),
  ]);

  const total = count.rows[0].total;
  res.json({
    products: list.rows.map((r) => ({ ...r, images: r.images ?? [] })),
    page: q.page,
    limit: q.limit,
    total,
    pages: Math.max(1, Math.ceil(total / q.limit)),
  });
});

catalogRouter.get('/products/:slug', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.slug, p.name, p.description, p.details, p.featured, p.created_at AS "createdAt",
            json_build_object('id', c.id, 'slug', c.slug, 'name', c.name) AS category,
            COALESCE((SELECT json_agg(json_build_object('url', i.url, 'alt', i.alt, 'creditName', i.credit_name,
                       'creditUrl', i.credit_url) ORDER BY i.position, i.id)
                        FROM product_images i WHERE i.product_id = p.id), '[]'::json) AS images,
            COALESCE((SELECT json_agg(json_build_object('id', v.id, 'sku', v.sku, 'name', v.name,
                       'priceCents', v.price_cents, 'stock', v.stock) ORDER BY v.position, v.id)
                        FROM variants v WHERE v.product_id = p.id AND v.active), '[]'::json) AS variants
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.slug = $1 AND p.active AND c.active`,
    [String(req.params.slug).slice(0, 100)],
  );
  if (!rows[0]) throw notFound('Product');
  res.json({ product: rows[0] });
});
