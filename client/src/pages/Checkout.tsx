import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Field, Notice, Spinner, TextArea } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api, ApiError, errorMessage } from '../lib/api';
import { formatMoney, sized } from '../lib/format';
import type { Address, Order } from '../lib/types';
import { OrderSummary } from './Cart';

const EMPTY: Address = { name: '', line1: '', line2: '', city: '', region: '', postal: '', country: '', phone: '' };

export function Checkout() {
  const { user } = useAuth();
  const { cart, loading, refresh, clear } = useCart();
  const [address, setAddress] = useState<Address>({ ...EMPTY, name: user?.name ?? '' });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // One key per checkout attempt: a double click or a retry after a timeout cannot create a second order.
  const idempotencyKey = useRef(crypto.randomUUID());
  const inFlight = useRef(false);
  const [placedId, setPlacedId] = useState<number | null>(null);

  // Checked before the empty-bag redirect: the bag is emptied as soon as the order exists.
  if (placedId !== null) return <Navigate to={`/account/orders/${placedId}?placed=1`} replace />;
  if (loading && !cart) return <Spinner label="Loading checkout" />;
  if (!cart || cart.items.length === 0) return <Navigate to="/cart" replace />;

  const set = (key: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => setAddress((a) => ({ ...a, [key]: e.target.value }));
  const fieldError = (key: string) => error?.fieldMessage(`address.${key}`);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const r = await api<{ order: Order }>('/orders', {
        method: 'POST',
        body: { idempotencyKey: idempotencyKey.current, address, notes },
      });
      setPlacedId(r.order.id);
      clear();
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', errorMessage(err));
      setError(apiErr);
      if (apiErr.code === 'STOCK_CHANGED' || apiErr.code === 'CART_EMPTY') {
        idempotencyKey.current = crypto.randomUUID();
        await refresh().catch(() => {});
      }
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="container page">
      <header className="page-head">
        <h1 className="page-title">Checkout</h1>
      </header>
      <div className="cart-layout">
        <form className="checkout-form" onSubmit={onSubmit} noValidate>
          {error && (
            <Notice tone="error">
              {error.message}
              {error.code === 'STOCK_CHANGED' && (
                <>
                  {' '}
                  <Link to="/cart" className="text-link">
                    Review your bag
                  </Link>
                </>
              )}
            </Notice>
          )}
          <fieldset className="form-section">
            <legend className="sub-title">Delivery address</legend>
            <div className="form-grid">
              <Field label="Full name" value={address.name} onChange={set('name')} autoComplete="name" required maxLength={120} error={fieldError('name')} className="span-2" />
              <Field label="Address" value={address.line1} onChange={set('line1')} autoComplete="address-line1" required maxLength={200} error={fieldError('line1')} className="span-2" />
              <Field label="Apartment, suite (optional)" value={address.line2} onChange={set('line2')} autoComplete="address-line2" maxLength={200} className="span-2" />
              <Field label="City" value={address.city} onChange={set('city')} autoComplete="address-level2" required maxLength={100} error={fieldError('city')} />
              <Field label="State / region (optional)" value={address.region} onChange={set('region')} autoComplete="address-level1" maxLength={100} />
              <Field label="Postal code" value={address.postal} onChange={set('postal')} autoComplete="postal-code" required maxLength={20} error={fieldError('postal')} />
              <Field label="Country" value={address.country} onChange={set('country')} autoComplete="country-name" required maxLength={60} error={fieldError('country')} />
              <Field label="Phone" type="tel" value={address.phone} onChange={set('phone')} autoComplete="tel" required maxLength={30} error={fieldError('phone')} hint="Used only for delivery questions" className="span-2" />
            </div>
          </fieldset>
          <TextArea label="Delivery notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} />

          <fieldset className="form-section">
            <legend className="sub-title">Payment</legend>
            <div className="payment-option">
              <Icon name="wallet" size={22} />
              <div>
                <strong>Pay on delivery</strong>
                <p>
                  This demo store does not take online payments and never asks for card details. Your order is
                  recorded as <em>unpaid</em> until the store marks it paid.
                </p>
              </div>
            </div>
          </fieldset>

          <button type="submit" className="btn btn-accent btn-block" disabled={submitting || cart.hasIssues}>
            {submitting ? 'Placing order…' : `Place order · ${formatMoney(cart.totalCents)}`}
          </button>
        </form>

        <OrderSummary cart={cart}>
          <ul className="mini-lines">
            {cart.items.map((i) => (
              <li key={i.variantId}>
                {i.imageUrl && <img src={sized(i.imageUrl, 120)} alt="" />}
                <span>
                  {i.productName}
                  <small>
                    {i.variantName} × {i.quantity}
                  </small>
                </span>
                <span>{formatMoney(i.unitPriceCents * i.quantity)}</span>
              </li>
            ))}
          </ul>
        </OrderSummary>
      </div>
    </div>
  );
}
