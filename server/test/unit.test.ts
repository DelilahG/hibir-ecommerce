import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { calculateTotals, FLAT_SHIPPING_CENTS } from '../src/lib/pricing.js';
import { addressSchema, productInput, registerSchema } from '../src/schemas.js';

describe('calculateTotals', () => {
  it('charges flat shipping below the free threshold', () => {
    expect(calculateTotals([{ unitPriceCents: 2500, quantity: 2 }])).toEqual({
      subtotalCents: 5000,
      shippingCents: FLAT_SHIPPING_CENTS,
      totalCents: 5000 + FLAT_SHIPPING_CENTS,
    });
  });
  it('ships free at or above the threshold', () => {
    expect(calculateTotals([{ unitPriceCents: 7500, quantity: 1 }]).shippingCents).toBe(0);
  });
  it('returns zeros for an empty bag', () => {
    expect(calculateTotals([])).toEqual({ subtotalCents: 0, shippingCents: 0, totalCents: 0 });
  });
});

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toContain('correct');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong horse battery', hash)).toBe(false);
  });
  it('salts every hash', async () => {
    expect(await hashPassword('same password!')).not.toBe(await hashPassword('same password!'));
  });
  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });
});

describe('validation schemas', () => {
  it('normalises email and enforces password length', () => {
    expect(registerSchema.parse({ name: 'A', email: ' Me@Example.COM ', password: 'longenough1' }).email).toBe(
      'me@example.com',
    );
    expect(registerSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'short' }).success).toBe(false);
  });
  it('rejects malformed phone numbers', () => {
    const base = { name: 'A', line1: '1 St', city: 'X', postal: '123', country: 'Y' };
    expect(addressSchema.safeParse({ ...base, phone: '<script>' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...base, phone: '+1 (555) 010-2030' }).success).toBe(true);
  });
  it('rejects non-https images, duplicate SKUs and negative stock', () => {
    const base = { slug: 'ok', name: 'Ok', categoryId: 1 };
    const variant = { sku: 'A-1', name: 'One', priceCents: 100, stock: 1 };
    expect(productInput.safeParse({ ...base, variants: [variant], images: [{ url: 'http://x.test/a.jpg', alt: 'a' }] }).success).toBe(false);
    expect(productInput.safeParse({ ...base, variants: [variant, { ...variant }] }).success).toBe(false);
    expect(productInput.safeParse({ ...base, variants: [{ ...variant, stock: -1 }] }).success).toBe(false);
    expect(productInput.safeParse({ ...base, variants: [variant] }).success).toBe(true);
  });
});
