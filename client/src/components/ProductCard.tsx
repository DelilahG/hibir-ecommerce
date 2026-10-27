import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { errorMessage } from '../lib/api';
import { formatPriceRange, isNew, sized } from '../lib/format';
import type { ProductSummary } from '../lib/types';
import { Icon } from './Icon';

export function ProductCard({ product }: { product: ProductSummary }) {
  const { add } = useCart();
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [primary, secondary] = product.images;
  const soldOut = product.totalStock <= 0;
  // Products with several variants need a choice on the product page first.
  const quickAdd = product.variantCount === 1 && product.defaultVariantId !== null;

  async function onAdd() {
    if (!product.defaultVariantId) return;
    setState('busy');
    try {
      await add(product.defaultVariantId);
      setState('added');
      setTimeout(() => setState('idle'), 1800);
    } catch (err) {
      setMessage(errorMessage(err));
      setState('error');
    }
  }

  return (
    <article className="product-card">
      <Link to={`/product/${product.slug}`} className="product-media">
        {primary ? (
          <>
            <img src={sized(primary.url, 600)} alt={primary.alt} loading="lazy" />
            {secondary && <img className="product-media-alt" src={sized(secondary.url, 600)} alt="" loading="lazy" />}
          </>
        ) : (
          <span className="product-media-empty">
            <Icon name="image" size={28} />
          </span>
        )}
        {soldOut ? <span className="tag tag-muted">Sold out</span> : isNew(product.createdAt) && <span className="tag">New</span>}
      </Link>
      <div className="product-body">
        <p className="product-category">{product.category.name}</p>
        <h3 className="product-name">
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>
        <div className="product-foot">
          <span className="price">{formatPriceRange(product.minPriceCents, product.maxPriceCents)}</span>
          {!soldOut &&
            (quickAdd ? (
              <button
                type="button"
                className={`icon-btn icon-btn-dark ${state === 'added' ? 'is-done' : ''}`}
                onClick={onAdd}
                disabled={state === 'busy'}
                aria-label={state === 'added' ? `${product.name} added to bag` : `Add ${product.name} to bag`}
              >
                <Icon name={state === 'added' ? 'check' : 'bag'} size={18} />
              </button>
            ) : (
              <Link to={`/product/${product.slug}`} className="icon-btn icon-btn-dark" aria-label={`Choose options for ${product.name}`}>
                <Icon name="arrowRight" size={18} />
              </Link>
            ))}
        </div>
        {state === 'error' && (
          <p className="field-error" role="alert">
            {message}
          </p>
        )}
      </div>
    </article>
  );
}
