import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { EmptyState, Notice, QuantityStepper, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { errorMessage } from '../lib/api';
import { formatMoney, sized } from '../lib/format';
import type { Cart as CartData } from '../lib/types';

export function OrderSummary({ cart, children }: { cart: CartData; children?: React.ReactNode }) {
  const remaining = 7500 - cart.subtotalCents;
  return (
    <aside className="summary" aria-label="Order summary">
      <h2 className="sub-title">Summary</h2>
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatMoney(cart.subtotalCents)}</dd>
        </div>
        <div>
          <dt>Shipping</dt>
          <dd>{cart.shippingCents === 0 ? 'Free' : formatMoney(cart.shippingCents)}</dd>
        </div>
        <div className="summary-total">
          <dt>Total</dt>
          <dd>{formatMoney(cart.totalCents)}</dd>
        </div>
      </dl>
      {remaining > 0 && cart.subtotalCents > 0 && (
        <p className="summary-note">Add {formatMoney(remaining)} more for free shipping.</p>
      )}
      {children}
    </aside>
  );
}

export function Cart() {
  const { cart, loading, setQuantity, remove } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function run(variantId: number, fn: () => Promise<void>) {
    setPending(variantId);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  if (loading && !cart) return <Spinner label="Loading your bag" />;
  if (!cart || cart.items.length === 0) {
    return (
      <div className="container page">
        <EmptyState icon="bag" title="Your bag is empty" action={<Link to="/shop" className="btn btn-dark">Start shopping</Link>}>
          Items you add will be saved here, even if you close the browser.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container page">
      <header className="page-head">
        <h1 className="page-title">Your bag</h1>
      </header>
      {error && <Notice tone="error">{error}</Notice>}
      {cart.hasIssues && (
        <Notice tone="error">Some items changed since you added them. Update or remove them before checking out.</Notice>
      )}
      <div className="cart-layout">
        <ul className="cart-lines">
          {cart.items.map((item) => (
            <li key={item.variantId} className={`cart-line ${item.issue ? 'has-issue' : ''}`} aria-busy={pending === item.variantId}>
              <Link to={`/product/${item.slug}`} className="cart-thumb">
                {item.imageUrl && <img src={sized(item.imageUrl, 200)} alt={item.imageAlt} />}
              </Link>
              <div className="cart-line-info">
                <Link to={`/product/${item.slug}`} className="cart-line-name">
                  {item.productName}
                </Link>
                <span className="cart-line-variant">{item.variantName}</span>
                <span className="cart-line-unit">{formatMoney(item.unitPriceCents)} each</span>
                {item.issue === 'unavailable' && <span className="field-error">No longer available</span>}
                {item.issue === 'insufficient_stock' && (
                  <span className="field-error">
                    {item.stock === 0 ? 'Sold out' : `Only ${item.stock} left. Lower the quantity to continue.`}
                  </span>
                )}
              </div>
              <div className="cart-line-actions">
                {item.available && item.stock > 0 && (
                  <QuantityStepper
                    value={item.quantity}
                    max={Math.min(10, Math.max(item.stock, 1))}
                    disabled={pending === item.variantId}
                    label={`Quantity for ${item.productName}`}
                    onChange={(n) => run(item.variantId, () => setQuantity(item.variantId, Math.min(n, item.stock)))}
                  />
                )}
                <span className="cart-line-total">{formatMoney(item.unitPriceCents * item.quantity)}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${item.productName} from bag`}
                  disabled={pending === item.variantId}
                  onClick={() => run(item.variantId, () => remove(item.variantId))}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <OrderSummary cart={cart}>
          <button
            type="button"
            className="btn btn-accent btn-block"
            disabled={cart.hasIssues}
            onClick={() => navigate(user ? '/checkout' : '/login?next=/checkout')}
          >
            {user ? 'Checkout' : 'Sign in to checkout'} <Icon name="arrowRight" size={18} />
          </button>
          <p className="summary-note">Prices and stock are confirmed again when you place the order.</p>
        </OrderSummary>
      </div>
    </div>
  );
}
