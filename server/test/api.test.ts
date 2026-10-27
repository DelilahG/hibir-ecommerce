import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';
import { migrate } from '../src/migrate.js';

const app = createApp();

const address = {
  name: 'Test Customer',
  line1: '12 Example Street',
  city: 'Springfield',
  postal: '12345',
  country: 'United States',
  phone: '+1 555 010 2030',
};

let ids: { category: number; product: number; tee: number; teeLarge: number; lamp: number; hidden: number };

async function resetDb() {
  await pool.query(
    'TRUNCATE order_items, orders, cart_items, carts, sessions, users, variants, product_images, products, categories RESTART IDENTITY CASCADE',
  );
  const cat = await pool.query(`INSERT INTO categories (slug, name) VALUES ('apparel', 'Apparel') RETURNING id`);
  const category = cat.rows[0].id;
  const mk = async (slug: string, name: string, active = true) =>
    (
      await pool.query(
        `INSERT INTO products (slug, name, description, category_id, active) VALUES ($1, $2, 'Plain cotton', $3, $4) RETURNING id`,
        [slug, name, category, active],
      )
    ).rows[0].id as number;
  const variant = async (productId: number, sku: string, price: number, stock: number) =>
    (
      await pool.query(
        `INSERT INTO variants (product_id, sku, name, price_cents, stock) VALUES ($1, $2, $2, $3, $4) RETURNING id`,
        [productId, sku, price, stock],
      )
    ).rows[0].id as number;

  const product = await mk('white-tee', 'White Tee');
  const tee = await variant(product, 'TEE-M', 2500, 3);
  const teeLarge = await variant(product, 'TEE-L', 2500, 0);
  const lampProduct = await mk('desk-lamp', 'Desk Lamp');
  const lamp = await variant(lampProduct, 'LAMP-1', 8000, 10);
  const hiddenProduct = await mk('hidden', 'Hidden Item', false);
  const hidden = await variant(hiddenProduct, 'HID-1', 1000, 10);

  await pool.query(`INSERT INTO users (email, name, password_hash, role) VALUES ('admin@test.dev', 'Admin', $1, 'admin')`, [
    await hashPassword('admin-password-123'),
  ]);
  ids = { category, product, tee, teeLarge, lamp, hidden };
}

async function customer(email = `c${randomUUID().slice(0, 8)}@test.dev`) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name: 'Customer', email, password: 'customer-pass-1' });
  expect(res.status).toBe(201);
  return agent;
}

async function admin() {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: 'admin@test.dev', password: 'admin-password-123' });
  expect(res.status).toBe(200);
  return agent;
}

const checkout = (agent: ReturnType<typeof request.agent>, key = randomUUID(), extra = {}) =>
  agent.post('/api/orders').send({ idempotencyKey: key, address, ...extra });

beforeAll(async () => {
  await migrate(pool, () => {});
});
beforeEach(resetDb);
afterAll(async () => {
  await pool.end();
});

describe('auth', () => {
  it('registers, reports the session and logs out', async () => {
    const agent = await customer('new@test.dev');
    expect((await agent.get('/api/auth/me')).body.user).toMatchObject({ email: 'new@test.dev', role: 'customer' });
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });

  it('rejects duplicate emails regardless of case', async () => {
    await customer('dup@test.dev');
    const res = await request(app).post('/api/auth/register').send({ name: 'X', email: 'DUP@test.dev', password: 'another-pass-1' });
    expect(res.status).toBe(409);
  });

  it('rejects weak passwords and bad credentials without leaking details', async () => {
    const weak = await request(app).post('/api/auth/register').send({ name: 'X', email: 'w@test.dev', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields[0].path).toBe('password');

    const bad = await request(app).post('/api/auth/login').send({ email: 'admin@test.dev', password: 'wrong-password' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@test.dev', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(unknown.body).toEqual(bad.body);
  });

  it('never returns password hashes', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.dev', password: 'admin-password-123' });
    expect(JSON.stringify(res.body)).not.toContain('scrypt');
  });
});

describe('catalog', () => {
  it('lists only active products and supports search and sorting', async () => {
    const all = await request(app).get('/api/products?sort=price_desc');
    expect(all.body.products.map((p: { slug: string }) => p.slug)).toEqual(['desk-lamp', 'white-tee']);
    const search = await request(app).get('/api/products?q=lamp');
    expect(search.body.total).toBe(1);
    const none = await request(app).get('/api/products?q=%25');
    expect(none.body.total).toBe(0);
  });

  it('returns 404 for inactive products and 400 for bad query params', async () => {
    expect((await request(app).get('/api/products/hidden')).status).toBe(404);
    expect((await request(app).get('/api/products?sort=evil')).status).toBe(400);
  });
});

describe('cart', () => {
  it('keeps a guest cart and merges it into the account on login', async () => {
    const guest = request.agent(app);
    expect((await guest.post('/api/cart/items').send({ variantId: ids.tee, quantity: 2 })).status).toBe(201);
    expect((await guest.get('/api/cart')).body.cart.itemCount).toBe(2);

    await guest.post('/api/auth/register').send({ name: 'G', email: 'guest@test.dev', password: 'guest-pass-123' });
    const cart = (await guest.get('/api/cart')).body.cart;
    expect(cart.itemCount).toBe(2);
    expect(cart.subtotalCents).toBe(5000);
  });

  it('refuses quantities above stock, out-of-stock and inactive variants', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/api/cart/items').send({ variantId: ids.tee, quantity: 4 })).status).toBe(409);
    expect((await agent.post('/api/cart/items').send({ variantId: ids.teeLarge, quantity: 1 })).status).toBe(409);
    expect((await agent.post('/api/cart/items').send({ variantId: ids.hidden, quantity: 1 })).status).toBe(404);
    expect((await agent.post('/api/cart/items').send({ variantId: 'abc' })).status).toBe(400);
  });
});

describe('checkout', () => {
  it('requires a signed-in customer', async () => {
    expect((await checkout(request.agent(app))).status).toBe(401);
  });

  it('creates an order from server prices, decrements stock and empties the cart', async () => {
    const agent = await customer();
    await agent.post('/api/cart/items').send({ variantId: ids.tee, quantity: 2 });
    const res = await checkout(agent, randomUUID(), { totalCents: 1, items: [{ variantId: ids.tee, unitPriceCents: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({
      status: 'pending',
      paymentStatus: 'unpaid',
      subtotalCents: 5000,
      shippingCents: 600,
      totalCents: 5600,
    });
    expect((await pool.query('SELECT stock FROM variants WHERE id = $1', [ids.tee])).rows[0].stock).toBe(1);
    expect((await agent.get('/api/cart')).body.cart.itemCount).toBe(0);

    const history = await agent.get('/api/orders');
    expect(history.body.orders).toHaveLength(1);
  });

  it('applies free shipping over the threshold', async () => {
    const agent = await customer();
    await agent.post('/api/cart/items').send({ variantId: ids.lamp, quantity: 1 });
    expect((await checkout(agent)).body.order.shippingCents).toBe(0);
  });

  it('treats a repeated submission with the same key as the same order', async () => {
    const agent = await customer();
    await agent.post('/api/cart/items').send({ variantId: ids.tee, quantity: 1 });
    const key = randomUUID();
    const [a, b] = await Promise.all([checkout(agent, key), checkout(agent, key)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.order.id).toBe(b.body.order.id);
    expect((await pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT stock FROM variants WHERE id = $1', [ids.tee])).rows[0].stock).toBe(2);
  });

  it('never oversells when two customers race for the last units', async () => {
    const [one, two] = await Promise.all([customer(), customer()]);
    await one.post('/api/cart/items').send({ variantId: ids.tee, quantity: 2 });
    await two.post('/api/cart/items').send({ variantId: ids.tee, quantity: 2 });
    const results = await Promise.all([checkout(one), checkout(two)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const failed = results.find((r) => r.status === 409)!;
    expect(failed.body.error.code).toBe('STOCK_CHANGED');
    expect((await pool.query('SELECT stock FROM variants WHERE id = $1', [ids.tee])).rows[0].stock).toBe(1);
  });

  it('uses the current price and blocks items deactivated after they were added', async () => {
    const agent = await customer();
    await agent.post('/api/cart/items').send({ variantId: ids.tee, quantity: 1 });
    await pool.query('UPDATE variants SET price_cents = 3100 WHERE id = $1', [ids.tee]);
    await agent.post('/api/cart/items').send({ variantId: ids.lamp, quantity: 1 });
    await pool.query('UPDATE products SET active = false WHERE slug = $1', ['desk-lamp']);

    const blocked = await checkout(agent);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.details).toEqual([{ variantId: ids.lamp, reason: 'unavailable', available: 0 }]);

    await agent.delete(`/api/cart/items/${ids.lamp}`);
    const ok = await checkout(agent);
    expect(ok.body.order.subtotalCents).toBe(3100);
  });

  it('rejects empty carts and invalid addresses', async () => {
    const agent = await customer();
    expect((await checkout(agent)).body.error.code).toBe('CART_EMPTY');
    const res = await agent.post('/api/orders').send({ idempotencyKey: randomUUID(), address: { ...address, postal: '' } });
    expect(res.status).toBe(400);
  });

  it("hides other customers' orders", async () => {
    const owner = await customer();
    await owner.post('/api/cart/items').send({ variantId: ids.tee, quantity: 1 });
    const orderId = (await checkout(owner)).body.order.id;
    const other = await customer();
    expect((await other.get(`/api/orders/${orderId}`)).status).toBe(404);
    expect((await owner.get(`/api/orders/${orderId}`)).status).toBe(200);
  });
});

describe('administration', () => {
  it('blocks anonymous users and customers', async () => {
    expect((await request(app).get('/api/admin/summary')).status).toBe(401);
    const agent = await customer();
    expect((await agent.get('/api/admin/summary')).status).toBe(403);
    expect((await agent.patch(`/api/admin/variants/${ids.tee}`).send({ stock: 999 })).status).toBe(403);
    expect((await pool.query('SELECT stock FROM variants WHERE id = $1', [ids.tee])).rows[0].stock).toBe(3);
  });

  it('creates and edits products, keeping variants that orders reference', async () => {
    const agent = await admin();
    const created = await agent.post('/api/admin/products').send({
      slug: 'linen-cushion',
      name: 'Linen Cushion',
      categoryId: ids.category,
      images: [{ url: 'https://images.example.com/c.jpg', alt: 'Cushion' }],
      variants: [
        { sku: 'CUSH-S', name: 'Small', priceCents: 3000, stock: 5 },
        { sku: 'CUSH-L', name: 'Large', priceCents: 4000, stock: 5 },
      ],
    });
    expect(created.status).toBe(201);
    const [small] = created.body.product.variants;

    const updated = await agent.put(`/api/admin/products/${created.body.product.id}`).send({
      slug: 'linen-cushion',
      name: 'Linen Cushion',
      categoryId: ids.category,
      variants: [{ id: small.id, sku: 'CUSH-S', name: 'Small', priceCents: 3200, stock: 7 }],
    });
    expect(updated.status).toBe(200);
    const variants = updated.body.product.variants;
    expect(variants).toHaveLength(2);
    expect(variants.find((v: { sku: string }) => v.sku === 'CUSH-L').active).toBe(false);

    const dup = await agent.post('/api/admin/products').send({
      slug: 'linen-cushion',
      name: 'Copy',
      categoryId: ids.category,
      variants: [{ sku: 'X-1', name: 'X', priceCents: 1, stock: 1 }],
    });
    expect(dup.status).toBe(409);
  });

  it('moves orders through valid statuses and restocks on cancellation', async () => {
    const buyer = await customer();
    await buyer.post('/api/cart/items').send({ variantId: ids.tee, quantity: 2 });
    const orderId = (await checkout(buyer)).body.order.id;
    const agent = await admin();

    expect((await agent.patch(`/api/admin/orders/${orderId}`).send({ status: 'delivered' })).status).toBe(409);
    const cancelled = await agent.patch(`/api/admin/orders/${orderId}`).send({ status: 'cancelled' });
    expect(cancelled.body.order.status).toBe('cancelled');
    expect((await pool.query('SELECT stock FROM variants WHERE id = $1', [ids.tee])).rows[0].stock).toBe(3);
    // A cancelled order cannot be reopened, so stock is never returned twice.
    expect((await agent.patch(`/api/admin/orders/${orderId}`).send({ status: 'processing' })).status).toBe(409);

    const summary = await agent.get('/api/admin/summary');
    expect(summary.body.ordersByStatus.cancelled).toBe(1);
  });
});

describe('request hardening', () => {
  it('rejects cross-site and non-JSON writes', async () => {
    const evil = await request(app).post('/api/cart/items').set('Origin', 'https://evil.example').send({ variantId: ids.tee });
    expect(evil.status).toBe(403);
    const form = await request(app).post('/api/auth/login').type('form').send('email=a&password=b');
    expect(form.status).toBe(415);
  });

  it('hides internal errors and unknown routes', async () => {
    expect((await request(app).get('/api/nope')).status).toBe(404);
    const malformed = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(malformed.status).toBe(400);
  });
});
