// Browser walkthrough of the main journeys against a running dev server (npm run dev).
// Uses the locally installed Google Chrome through playwright-core and saves screenshots
// to docs/screenshots. Usage: node scripts/e2e.mjs [baseUrl] [--keep]
// Test data it creates (the customer account, its order and the admin session) is removed
// afterwards and reserved stock is returned. Pass --keep to leave it in place for debugging.
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const BASE = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:5173';
const KEEP = args.includes('--keep');
const SHOTS = new URL('../docs/screenshots/', import.meta.url);
mkdirSync(SHOTS, { recursive: true });

const env = Object.fromEntries(
  readFileSync(new URL('../server/.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

// Everything this run creates, so it can be removed afterwards.
const created = { emails: [], sessionTokens: [] };

const problems = [];
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
}

function watch(page, label) {
  // 4xx responses are expected: several checks deliberately trigger validation and not-found errors.
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && problems.push(`[${label}] console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`[${label}] page error: ${e.message}`));
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 500) problems.push(`[${label}] ${r.status()} ${r.url()}`);
  });
}

async function shot(page, name, fullPage = false) {
  if (fullPage) {
    // Scroll through the page so lazy-loaded images are fetched before capturing.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle');
  }
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, SHOTS)), fullPage });
}

async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  // ---------- desktop customer journey ----------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desk.newPage();
  watch(page, 'desktop');

  await page.goto(BASE);
  await page.getByRole('heading', { name: /Good things/ }).waitFor();
  await page.locator('.product-grid .product-card').first().waitFor();
  await page.waitForLoadState('networkidle');
  check('home renders hero, categories and products', (await page.locator('.category-tile').count()) === 6);
  check('home has no horizontal scroll (desktop)', await noHorizontalScroll(page));
  await shot(page, 'home-desktop', true);

  await page.goto(`${BASE}/shop?category=audio&sort=price_desc`);
  await page.locator('.product-card').first().waitFor();
  const prices = await page.locator('.product-card .price').allTextContents();
  const nums = prices.map((p) => Number(p.replace(/[^0-9.]/g, '')));
  check('category filter + price sort', nums.length === 4 && nums.every((n, i) => i === 0 || nums[i - 1] >= n), prices.join(', '));
  await page.waitForLoadState('networkidle');
  await shot(page, 'shop-desktop');

  await page.goto(`${BASE}/shop?q=zzzz-no-match`);
  await page.getByText('Nothing matches yet').waitFor();
  check('empty search state shown', true);

  await page.goto(`${BASE}/product/heavyweight-hoodie-cream`);
  await page.getByRole('heading', { name: 'Heavyweight Hoodie' }).waitFor();
  await page.getByText('L', { exact: true }).click();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: /Add to bag/ }).click();
  await page.getByText(/Added 2 × Heavyweight Hoodie/).waitFor();
  check('guest adds variant with quantity', (await page.locator('.bag-count').textContent()) === '2');
  await page.waitForLoadState('networkidle');
  await shot(page, 'product-desktop');

  await page.goto(`${BASE}/product/does-not-exist`);
  await page.getByText('This product isn’t available').waitFor();
  check('unknown product shows not-found state', true);

  await page.goto(`${BASE}/cart`);
  await page.getByRole('button', { name: 'Sign in to checkout' }).click();
  await page.waitForURL(/\/login\?next=%2Fcheckout|\/login\?next=\/checkout/);
  await page.getByRole('link', { name: 'Create an account' }).click();
  const email = `e2e-${Date.now()}@example.test`;
  created.emails.push(email);
  await page.getByLabel('Name').fill('Test Customer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByText('Use at least 10 characters').waitFor();
  check('register shows field validation error', true);
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/checkout$/);
  check('guest bag survives registration', (await page.locator('.bag-count').textContent()) === '2');

  await page.getByRole('button', { name: /Place order/ }).click();
  await page.getByText('Full name').first().waitFor();
  check('checkout blocks empty required fields', (await page.locator('.field-error').count()) > 0);
  await page.getByLabel('Address', { exact: true }).fill('12 Example Street');
  await page.getByLabel('City').fill('Springfield');
  await page.getByLabel('Postal code').fill('12345');
  await page.getByLabel('Country').fill('United States');
  await page.getByLabel('Phone').fill('+1 555 010 2030');
  await shot(page, 'checkout-desktop');
  await page.getByRole('button', { name: /Place order/ }).dblclick();
  await page.waitForURL(/\/account\/orders\/\d+\?placed=1/);
  await page.getByText(/your order is in/).waitFor();
  const total = await page.locator('.summary-total dd').textContent();
  check('order placed with server total', total === '$136.00', total ?? '');
  await page.waitForLoadState('networkidle');
  await shot(page, 'order-desktop');

  await page.goto(`${BASE}/account`);
  await page.locator('.order-row').first().waitFor();
  check('double-click created exactly one order', (await page.locator('.order-row').count()) === 1);

  await page.goto(`${BASE}/admin`);
  await page.getByText('Staff only').waitFor();
  check('customer sees staff-only screen at /admin', true);
  await desk.close();

  // ---------- admin ----------
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await adminCtx.newPage();
  watch(admin, 'admin');
  await admin.goto(`${BASE}/login?next=/admin`);
  await admin.getByLabel('Email').fill(env.ADMIN_EMAIL);
  await admin.getByLabel('Password').fill(env.ADMIN_PASSWORD);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.getByRole('heading', { name: 'Overview' }).waitFor();
  check('admin overview loads', true);
  await shot(admin, 'admin-overview');

  await admin.goto(`${BASE}/admin/orders`);
  await admin.locator('.table tbody tr').first().waitFor();
  await admin.locator('.table tbody tr a').first().click();
  await admin.getByRole('button', { name: 'Start preparing' }).click();
  await admin.getByText('Order updated.').waitFor();
  check('admin advances order status', (await admin.locator('.page-head .badge').textContent()) === 'Preparing');

  await admin.goto(`${BASE}/admin/products`);
  await admin.locator('.table tbody tr').first().waitFor();
  await admin.locator('.table-product', { hasText: 'Heavyweight Hoodie' }).click();
  await admin.getByRole('heading', { name: 'Edit product' }).waitFor();
  check('product editor shows variants', (await admin.locator('.table-form tbody tr').count()) === 4);
  await shot(admin, 'admin-product', true);
  const adminSid = (await adminCtx.cookies()).find((c) => c.name === 'hibir_sid');
  if (adminSid) created.sessionTokens.push(adminSid.value);
  await adminCtx.close();

  // ---------- mobile ----------
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mob.newPage();
  watch(m, 'mobile');
  for (const [path, name] of [['/', 'home-mobile'], ['/shop', 'shop-mobile'], ['/product/navy-dial-bracelet-watch', 'product-mobile'], ['/cart', 'cart-mobile']]) {
    await m.goto(`${BASE}${path}`);
    await m.waitForLoadState('networkidle');
    check(`no horizontal scroll at 390px: ${path}`, await noHorizontalScroll(m));
    await shot(m, name, path === '/');
  }
  await m.goto(`${BASE}/shop`);
  await m.getByRole('button', { name: 'Filters' }).click();
  check('mobile filters toggle open', await m.locator('.filters.is-open').isVisible());
  await m.getByRole('button', { name: 'Open menu' }).click();
  check('mobile menu opens', await m.locator('.primary-nav.is-open').isVisible());
  await mob.close();
} finally {
  await browser.close();
  if (KEEP) console.log('\n--keep: test data left in the database');
  else await cleanUp().catch((err) => problems.push(`cleanup failed: ${err.message}`));
}

/** Deletes this run's customers and orders, returns their reserved stock, and ends the admin session. */
async function cleanUp() {
  const db = new pg.Client({ connectionString: env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN');
    // Only accounts this run registered, and never staff.
    const users = (
      await db.query("SELECT id FROM users WHERE role = 'customer' AND email = ANY($1)", [created.emails])
    ).rows.map((r) => r.id);
    // Cancelled orders have already been restocked, so only the others still hold stock.
    const restocked = await db.query(
      `UPDATE variants v SET stock = v.stock + s.qty
         FROM (SELECT i.variant_id, sum(i.quantity)::int AS qty
                 FROM order_items i JOIN orders o ON o.id = i.order_id
                WHERE o.user_id = ANY($1) AND o.status <> 'cancelled' AND i.variant_id IS NOT NULL
                GROUP BY i.variant_id) s
        WHERE v.id = s.variant_id`,
      [users],
    );
    const orders = await db.query('DELETE FROM orders WHERE user_id = ANY($1)', [users]);
    await db.query('DELETE FROM users WHERE id = ANY($1)', [users]); // sessions and carts cascade
    const hashes = created.sessionTokens.map((t) => createHash('sha256').update(t).digest('hex'));
    const sessions = await db.query('DELETE FROM sessions WHERE token_hash = ANY($1)', [hashes]);
    await db.query('COMMIT');
    console.log(
      `\nCleanup: removed ${users.length} test customer(s), ${orders.rowCount} order(s), ${sessions.rowCount} admin session(s); restocked ${restocked.rowCount} variant(s)`,
    );
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await db.end();
  }
}

if (problems.length) {
  console.log('\nProblems:');
  for (const p of problems) console.log(`  ${p}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed, ${problems.length} browser problems`);
process.exit(failed || problems.length ? 1 : 0);
