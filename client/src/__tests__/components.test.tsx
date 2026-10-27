import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProductCard } from '../components/ProductCard';
import { QuantityStepper } from '../components/ui';
import type { ProductSummary } from '../lib/types';

const add = vi.fn().mockResolvedValue(undefined);
vi.mock('../context/CartContext', () => ({ useCart: () => ({ add }) }));

const product: ProductSummary = {
  id: 1,
  slug: 'canvas-tote',
  name: 'Canvas Tote',
  featured: false,
  createdAt: '2020-01-01T00:00:00Z',
  category: { slug: 'accessories', name: 'Accessories' },
  minPriceCents: 3200,
  maxPriceCents: 3200,
  totalStock: 4,
  variantCount: 1,
  images: [{ url: 'https://images.unsplash.com/photo-x', alt: 'A canvas tote bag' }],
  defaultVariantId: 7,
};

const renderCard = (p: ProductSummary) =>
  render(
    <MemoryRouter>
      <ProductCard product={p} />
    </MemoryRouter>,
  );

describe('ProductCard', () => {
  it('adds single-variant products straight to the bag', async () => {
    renderCard(product);
    expect(screen.getByText('$32.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Canvas Tote to bag' }));
    expect(add).toHaveBeenCalledWith(7);
    expect(await screen.findByRole('button', { name: 'Canvas Tote added to bag' })).toBeInTheDocument();
  });

  it('sends multi-variant products to the product page and marks sold-out items', () => {
    const { unmount } = renderCard({ ...product, variantCount: 3, maxPriceCents: 4000 });
    expect(screen.getByRole('link', { name: 'Choose options for Canvas Tote' })).toHaveAttribute('href', '/product/canvas-tote');
    expect(screen.getByText('From $32.00')).toBeInTheDocument();
    unmount();
    renderCard({ ...product, totalStock: 0, defaultVariantId: null });
    expect(screen.getByText('Sold out')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bag/ })).not.toBeInTheDocument();
  });
});

describe('QuantityStepper', () => {
  it('respects the minimum and maximum', () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={1} max={2} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
