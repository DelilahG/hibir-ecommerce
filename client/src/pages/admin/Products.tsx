import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, Notice, Spinner } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatMoney, sized } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface AdminProductRow {
  id: number;
  slug: string;
  name: string;
  active: boolean;
  featured: boolean;
  categoryName: string;
  imageUrl: string | null;
  minPriceCents: number | null;
  totalStock: number;
  variantCount: number;
}

export function AdminProducts() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, loading, reload, setData } = useApi<{ products: AdminProductRow[] }>(
    `/admin/products${query ? `?q=${encodeURIComponent(query)}` : ''}`,
  );
  const [message, setMessage] = useState('');

  async function toggle(p: AdminProductRow, field: 'active' | 'featured') {
    setMessage('');
    try {
      const r = await api<{ product: { id: number; active: boolean; featured: boolean } }>(`/admin/products/${p.id}`, {
        method: 'PATCH',
        body: { [field]: !p[field] },
      });
      setData({ products: data!.products.map((x) => (x.id === p.id ? { ...x, ...r.product } : x)) });
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  return (
    <>
      <header className="page-head page-head-row">
        <h1 className="page-title">Products</h1>
        <Link to="/admin/products/new" className="btn btn-dark btn-sm">
          <Icon name="plus" size={16} /> New product
        </Link>
      </header>
      <form
        className="search-inline"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <input type="search" placeholder="Search by name or SKU" aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
        <button type="submit" className="btn btn-outline btn-sm">Search</button>
      </form>
      {message && <Notice tone="error">{message}</Notice>}
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <Spinner label="Loading products" />
      ) : data!.products.length === 0 ? (
        <EmptyState icon="tag" title="No products found" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className="num">Price from</th>
                <th className="num">Stock</th>
                <th>Featured</th>
                <th>Visible</th>
              </tr>
            </thead>
            <tbody>
              {data!.products.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'is-muted'}>
                  <td>
                    <Link to={`/admin/products/${p.id}`} className="table-product">
                      {p.imageUrl ? <img src={sized(p.imageUrl, 80)} alt="" /> : <span className="thumb-empty" />}
                      <span>
                        {p.name}
                        <small className="muted">{p.variantCount} variant{p.variantCount === 1 ? '' : 's'}</small>
                      </span>
                    </Link>
                  </td>
                  <td>{p.categoryName}</td>
                  <td className="num">{p.minPriceCents ? formatMoney(p.minPriceCents) : '—'}</td>
                  <td className={`num ${p.totalStock === 0 ? 'text-danger' : ''}`}>{p.totalStock}</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={p.featured} onChange={() => toggle(p, 'featured')} aria-label={`Feature ${p.name} on the homepage`} />
                      <span />
                    </label>
                  </td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={p.active} onChange={() => toggle(p, 'active')} aria-label={`${p.name} visible in the shop`} />
                      <span />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
