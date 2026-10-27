import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/ui';
import type { Category, ProductList } from '../lib/types';
import { useApi } from '../lib/useApi';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];

const PRICE_BANDS = [
  { id: '', label: 'Any price' },
  { id: '0-30', label: 'Under $30', min: 0, max: 2999 },
  { id: '30-80', label: '$30 – $80', min: 3000, max: 8000 },
  { id: '80-200', label: '$80 – $200', min: 8001, max: 20000 },
  { id: '200+', label: 'Over $200', min: 20001 },
];

export function Shop() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useApi<{ categories: Category[] }>('/categories');

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const inStock = params.get('inStock') === '1';
  const band = PRICE_BANDS.find((b) => b.id === params.get('price')) ?? PRICE_BANDS[0];
  const page = Math.max(1, Number(params.get('page')) || 1);

  const query = new URLSearchParams({ sort, page: String(page), limit: '12' });
  if (q) query.set('q', q);
  if (category) query.set('category', category);
  if (inStock) query.set('inStock', '1');
  if (band.min !== undefined) query.set('minPrice', String(band.min));
  if (band.max !== undefined) query.set('maxPrice', String(band.max));
  const list = useApi<ProductList>(`/products?${query}`);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  }

  const activeCategory = categories.data?.categories.find((c) => c.slug === category);
  const title = q ? `Results for “${q}”` : activeCategory?.name ?? 'All products';
  const hasFilters = Boolean(q || category || inStock || band.id);

  return (
    <div className="container page">
      <header className="page-head">
        <h1 className="page-title">{title}</h1>
        {activeCategory?.description && <p className="page-lede">{activeCategory.description}</p>}
      </header>

      <div className="shop-layout">
        <aside className={`filters ${filtersOpen ? 'is-open' : ''}`} aria-label="Filters">
          <fieldset>
            <legend>Category</legend>
            <label className="radio">
              <input type="radio" name="category" checked={!category} onChange={() => update({ category: null })} />
              All
            </label>
            {categories.data?.categories.map((c) => (
              <label key={c.id} className="radio">
                <input type="radio" name="category" checked={category === c.slug} onChange={() => update({ category: c.slug })} />
                {c.name}
                <span className="count">{c.productCount}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Price</legend>
            {PRICE_BANDS.map((b) => (
              <label key={b.id || 'any'} className="radio">
                <input type="radio" name="price" checked={band.id === b.id} onChange={() => update({ price: b.id || null })} />
                {b.label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Availability</legend>
            <label className="checkbox">
              <input type="checkbox" checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? '1' : null })} />
              In stock only
            </label>
          </fieldset>
          {hasFilters && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setParams(new URLSearchParams({ sort }))}>
              Clear filters
            </button>
          )}
        </aside>

        <section>
          <div className="toolbar">
            <button type="button" className="btn btn-outline btn-sm filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
              <Icon name="filter" size={18} /> Filters
            </button>
            <p className="result-count" aria-live="polite">
              {list.data ? `${list.data.total} product${list.data.total === 1 ? '' : 's'}` : ' '}
            </p>
            <label className="sort">
              <span>Sort</span>
              <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : list.loading && !list.data ? (
            <SkeletonGrid count={6} />
          ) : list.data && list.data.products.length === 0 ? (
            <EmptyState icon="search" title="Nothing matches yet" action={<Link className="btn btn-dark" to="/shop">See all products</Link>}>
              Try a different search term or remove a filter.
            </EmptyState>
          ) : (
            <>
              <div className={`product-grid product-grid-3 ${list.loading ? 'is-stale' : ''}`}>
                {list.data!.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {list.data!.pages > 1 && (
                <nav className="pagination" aria-label="Pagination">
                  <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                    <Icon name="arrowLeft" size={16} /> Previous
                  </button>
                  <span>
                    Page {page} of {list.data!.pages}
                  </span>
                  <button type="button" className="btn btn-outline btn-sm" disabled={page >= list.data!.pages} onClick={() => update({ page: String(page + 1) })}>
                    Next <Icon name="arrowRight" size={16} />
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
