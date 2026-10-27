export const FREE_SHIPPING_THRESHOLD_CENTS = 7500;
export const FLAT_SHIPPING_CENTS = 600;
export const MAX_QUANTITY_PER_LINE = 10;

export interface PricedLine {
  unitPriceCents: number;
  quantity: number;
}

export function calculateTotals(lines: PricedLine[]) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const shippingCents =
    subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}
