export interface User {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'admin';
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string;
  imageCredit?: string | null;
  imageCreditUrl?: string | null;
  productCount: number;
}

export interface Image {
  url: string;
  alt: string;
  creditName?: string | null;
  creditUrl?: string | null;
}

export interface ProductSummary {
  id: number;
  slug: string;
  name: string;
  featured: boolean;
  createdAt: string;
  category: { slug: string; name: string };
  minPriceCents: number;
  maxPriceCents: number;
  totalStock: number;
  variantCount: number;
  images: Image[];
  defaultVariantId: number | null;
}

export interface ProductList {
  products: ProductSummary[];
  page: number;
  pages: number;
  total: number;
}

export interface Variant {
  id: number;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
}

export interface ProductDetail {
  id: number;
  slug: string;
  name: string;
  description: string;
  details: string[];
  createdAt: string;
  category: { id: number; slug: string; name: string };
  images: Image[];
  variants: Variant[];
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

export interface Cart {
  items: CartLine[];
  itemCount: number;
  hasIssues: boolean;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface Address {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  phone: string;
}

export interface OrderItem {
  id: number;
  variantId: number | null;
  slug: string | null;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface Order {
  id: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  address: Address;
  notes: string;
  createdAt: string;
  updatedAt: string;
  customer: { id: number; name: string; email: string };
  items: OrderItem[];
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalCents: number;
  createdAt: string;
  itemCount: number;
  thumbnails?: string[];
  customerName?: string;
  customerEmail?: string;
}
