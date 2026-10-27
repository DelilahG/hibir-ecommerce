const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const formatMoney = (cents: number) => money.format(cents / 100);

export function formatPriceRange(min: number, max: number) {
  return min === max ? formatMoney(min) : `From ${formatMoney(min)}`;
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export const formatOrderNumber = (id: number) => `HB-${String(id).padStart(5, '0')}`;

/** Unsplash images accept sizing parameters; other hosts are returned unchanged. */
export function sized(url: string | null | undefined, width: number) {
  if (!url) return '';
  if (!url.startsWith('https://images.unsplash.com/')) return url;
  const u = new URL(url);
  u.searchParams.set('w', String(width));
  u.searchParams.set('q', '80');
  u.searchParams.set('auto', 'format');
  u.searchParams.set('fit', 'crop');
  return u.toString();
}

export const statusLabel: Record<string, string> = {
  pending: 'Received',
  processing: 'Preparing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  unpaid: 'Unpaid',
  paid: 'Paid',
  refunded: 'Refunded',
};

export const isNew = (createdAt: string, days = 30) => Date.now() - new Date(createdAt).getTime() < days * 86_400_000;
