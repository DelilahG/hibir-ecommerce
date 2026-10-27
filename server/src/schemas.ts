import { z } from 'zod';
import { MAX_QUANTITY_PER_LINE } from './lib/pricing.js';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number, label: string) => text(max).min(1, `${label} is required`);

export const idParam = z.coerce.number().int().positive();

export const registerSchema = z.object({
  name: required(80, 'Name'),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
  password: z
    .string()
    .min(10, 'Use at least 10 characters')
    .max(200, 'Password is too long'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().max(200),
});

export const catalogQuery = z.object({
  q: text(100).optional(),
  category: text(80).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'name']).default('newest'),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: z.enum(['1', 'true']).optional(),
  featured: z.enum(['1', 'true']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

export const addItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE).default(1),
});

export const setQuantitySchema = z.object({
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
});

export const addressSchema = z.object({
  name: required(120, 'Full name'),
  line1: required(200, 'Address'),
  line2: text(200).default(''),
  city: required(100, 'City'),
  region: text(100).default(''),
  postal: required(20, 'Postal code').regex(/^[A-Za-z0-9 -]+$/, 'Postal code contains invalid characters'),
  country: required(60, 'Country'),
  phone: required(30, 'Phone').regex(/^[0-9+()\-\s]{6,30}$/, 'Enter a valid phone number'),
});

export const checkoutSchema = z.object({
  idempotencyKey: z.uuid(),
  address: addressSchema,
  notes: text(500).default(''),
});

// ----- admin -----

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes');

const httpsUrl = z
  .url({ protocol: /^https$/, message: 'Image URLs must use https' })
  .max(500);

export const categoryInput = z.object({
  slug,
  name: required(80, 'Name'),
  description: text(500).default(''),
  imageUrl: httpsUrl.nullable().default(null),
  imageAlt: text(200).default(''),
  position: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

export const variantInput = z.object({
  id: z.number().int().positive().optional(),
  sku: required(60, 'SKU').regex(/^[A-Za-z0-9-]+$/, 'SKU may contain letters, numbers and dashes'),
  name: required(80, 'Variant name'),
  priceCents: z.number().int().min(1, 'Price must be positive').max(10_000_000),
  stock: z.number().int().min(0, 'Stock cannot be negative').max(1_000_000),
  active: z.boolean().default(true),
});

export const imageInput = z.object({
  url: httpsUrl,
  alt: required(200, 'Alt text'),
  creditName: text(120).nullable().default(null),
  creditUrl: httpsUrl.nullable().default(null),
});

export const productInput = z
  .object({
    slug,
    name: required(120, 'Name'),
    description: text(4000).default(''),
    details: z.array(text(200)).max(12).default([]),
    categoryId: z.number().int().positive(),
    active: z.boolean().default(true),
    featured: z.boolean().default(false),
    images: z.array(imageInput).max(8).default([]),
    variants: z.array(variantInput).min(1, 'Add at least one variant').max(30),
  })
  .refine((p) => new Set(p.variants.map((v) => v.sku.toUpperCase())).size === p.variants.length, {
    message: 'Variant SKUs must be unique',
    path: ['variants'],
  });

export const variantPatch = z
  .object({
    stock: z.number().int().min(0).max(1_000_000).optional(),
    priceCents: z.number().int().min(1).max(10_000_000).optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'] as const;

export const orderPatch = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  })
  .refine((v) => v.status || v.paymentStatus, 'Nothing to update');
