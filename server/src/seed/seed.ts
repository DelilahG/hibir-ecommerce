import { pool, withTransaction } from '../db.js';
import { hashPassword } from '../lib/password.js';
import { migrate } from '../migrate.js';
import { categories, products } from './catalog.js';

async function seedCatalog() {
  const existing = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM products');
  if (existing.rows[0].n > 0) {
    console.log(`catalogue already has ${existing.rows[0].n} products, skipping`);
    return;
  }
  await withTransaction(async (client) => {
    const categoryIds = new Map<string, number>();
    for (const [i, c] of categories.entries()) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO categories (slug, name, description, image_url, image_alt, image_credit, image_credit_url, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [c.slug, c.name, c.description, c.image.url, c.image.alt, c.image.credit, c.image.creditUrl, i],
      );
      categoryIds.set(c.slug, rows[0].id);
    }
    for (const p of products) {
      const created = new Date(Date.now() - p.ageDays * 86_400_000);
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO products (slug, name, description, details, category_id, featured, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id`,
        [p.slug, p.name, p.description, p.details, categoryIds.get(p.category), p.featured ?? false, created],
      );
      await client.query(
        `INSERT INTO product_images (product_id, url, alt, credit_name, credit_url) VALUES ($1, $2, $3, $4, $5)`,
        [rows[0].id, p.image.url, p.image.alt, p.image.credit, p.image.creditUrl],
      );
      for (const [i, v] of p.variants.entries()) {
        await client.query(
          `INSERT INTO variants (product_id, sku, name, price_cents, stock, position) VALUES ($1, $2, $3, $4, $5, $6)`,
          [rows[0].id, v.sku, v.name, v.price, v.stock, i],
        );
      }
    }
  });
  console.log(`seeded ${categories.length} categories and ${products.length} products`);
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set, no administrator created');
    return;
  }
  if (password.length < 12 || password.includes('CHANGE_ME')) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters and not the placeholder value');
  }
  const { rowCount } = await pool.query(
    `INSERT INTO users (email, name, password_hash, role) VALUES ($1, 'Store admin', $2, 'admin')
     ON CONFLICT DO NOTHING`,
    [email, await hashPassword(password)],
  );
  console.log(rowCount ? `created administrator ${email}` : `user ${email} already exists, left unchanged`);
}

try {
  await migrate();
  await seedCatalog();
  await seedAdmin();
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
