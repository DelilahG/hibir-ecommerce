import { describe, expect, it } from 'vitest';
import { formatMoney, formatOrderNumber, formatPriceRange, sized } from '../lib/format';

describe('format helpers', () => {
  it('formats cents as US dollars', () => {
    expect(formatMoney(2599)).toBe('$25.99');
    expect(formatMoney(0)).toBe('$0.00');
  });
  it('shows a range only when variant prices differ', () => {
    expect(formatPriceRange(1000, 1000)).toBe('$10.00');
    expect(formatPriceRange(1000, 2000)).toBe('From $10.00');
  });
  it('pads order numbers', () => {
    expect(formatOrderNumber(42)).toBe('HB-00042');
  });
  it('adds sizing parameters only to Unsplash URLs', () => {
    expect(sized('https://images.unsplash.com/photo-1', 400)).toContain('w=400');
    expect(sized('https://example.com/a.jpg', 400)).toBe('https://example.com/a.jpg');
    expect(sized(null, 400)).toBe('');
  });
});
