import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Breadcrumbs, EmptyState, ErrorState, Notice, QuantityStepper, Spinner } from '../components/ui';
import { useCart } from '../context/CartContext';
import { ApiError, errorMessage } from '../lib/api';
import { formatMoney, sized } from '../lib/format';
import type { ProductDetail } from '../lib/types';
import { useApi } from '../lib/useApi';

const MAX_PER_LINE = 10;

export function Product() {
  const { slug = '' } = useParams();
  const { data, error, loading, reload } = useApi<{ product: ProductDetail }>(`/products/${encodeURIComponent(slug)}`);
  const { cart, add } = useCart();
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const product = data?.product;

  useEffect(() => {
    if (!product) return;
    setImageIndex(0);
    setStatus(null);
    setQuantity(1);
    setVariantId((product.variants.find((v) => v.stock > 0) ?? product.variants[0])?.id ?? null);
    document.title = `${product.name} · Hibir`;
    return () => {
      document.title = 'Hibir';
    };
  }, [product]);

  if (loading && !product) return <Spinner label="Loading product" />;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="container page">
        <EmptyState icon="search" title="This product isn’t available" action={<Link to="/shop" className="btn btn-dark">Back to the shop</Link>}>
          It may have been removed or the link may be wrong.
        </EmptyState>
      </div>
    );
  }
  if (error || !product) return <div className="container page"><ErrorState error={error} onRetry={reload} /></div>;

  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const inBag = cart?.items.find((i) => i.variantId === variantId)?.quantity ?? 0;
  const maxQty = variant ? Math.max(0, Math.min(variant.stock, MAX_PER_LINE) - inBag) : 0;
  const image = product.images[imageIndex];

  async function onAdd() {
    if (!variant) return;
    setBusy(true);
    setStatus(null);
    try {
      await add(variant.id, quantity);
      setStatus({ tone: 'success', text: `Added ${quantity} × ${product!.name} to your bag.` });
      setQuantity(1);
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container page">
      <Breadcrumbs
        items={[
          { to: '/shop', label: 'Shop' },
          { to: `/shop?category=${product.category.slug}`, label: product.category.name },
          { label: product.name },
        ]}
      />
      <div className="pdp">
        <div className="pdp-gallery">
          <div className="pdp-main-image">
            {image ? <img src={sized(image.url, 1100)} alt={image.alt} /> : <Icon name="image" size={40} />}
          </div>
          {product.images.length > 1 && (
            <div className="pdp-thumbs" role="group" aria-label="Product images">
              {product.images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  className={i === imageIndex ? 'is-active' : ''}
                  aria-label={`Show image ${i + 1}`}
                  aria-pressed={i === imageIndex}
                  onClick={() => setImageIndex(i)}
                >
                  <img src={sized(img.url, 160)} alt="" />
                </button>
              ))}
            </div>
          )}
          {image?.creditName && (
            <p className="photo-credit">
              Photo:{' '}
              {image.creditUrl ? (
                <a href={image.creditUrl} target="_blank" rel="noreferrer">
                  {image.creditName}
                </a>
              ) : (
                image.creditName
              )}{' '}
              on Unsplash. Illustrative stock photography.
            </p>
          )}
        </div>

        <div className="pdp-info">
          <p className="product-category">{product.category.name}</p>
          <h1 className="pdp-title">{product.name}</h1>
          <p className="pdp-price">{variant ? formatMoney(variant.priceCents) : '—'}</p>

          {product.variants.length > 1 && (
            <fieldset className="variant-picker">
              <legend>Option</legend>
              <div className="variant-options">
                {product.variants.map((v) => (
                  <label key={v.id} className={`variant-option ${v.stock === 0 ? 'is-out' : ''}`}>
                    <input
                      type="radio"
                      name="variant"
                      value={v.id}
                      checked={v.id === variantId}
                      onChange={() => {
                        setVariantId(v.id);
                        setQuantity(1);
                        setStatus(null);
                      }}
                    />
                    <span>{v.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <p className={`stock ${variant && variant.stock > 0 ? (variant.stock <= 5 ? 'stock-low' : 'stock-ok') : 'stock-out'}`}>
            {!variant || variant.stock === 0
              ? 'Out of stock'
              : variant.stock <= 5
                ? `Only ${variant.stock} left`
                : 'In stock'}
            {inBag > 0 && ` · ${inBag} in your bag`}
          </p>

          <div className="pdp-buy">
            <QuantityStepper value={quantity} max={Math.max(1, maxQty)} onChange={setQuantity} disabled={maxQty === 0} />
            <button type="button" className="btn btn-dark btn-block" onClick={onAdd} disabled={busy || maxQty === 0 || quantity > maxQty}>
              <Icon name="bag" size={18} />
              {busy ? 'Adding…' : maxQty === 0 && variant && variant.stock > 0 ? 'Limit reached' : 'Add to bag'}
            </button>
          </div>
          {status && (
            <Notice tone={status.tone}>
              {status.text}{' '}
              {status.tone === 'success' && (
                <Link to="/cart" className="text-link">
                  View bag
                </Link>
              )}
            </Notice>
          )}

          <div className="pdp-description">
            <h2 className="sub-title">About this product</h2>
            {product.description.split('\n').filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            {product.details.length > 0 && (
              <ul className="detail-list">
                {product.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            {variant && <p className="sku">SKU {variant.sku}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
