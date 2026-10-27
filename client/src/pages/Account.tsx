import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Breadcrumbs, EmptyState, ErrorState, Notice, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { formatDate, formatMoney, formatOrderNumber, sized } from '../lib/format';
import type { Order, OrderSummary } from '../lib/types';
import { useApi } from '../lib/useApi';

export function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const orders = useApi<{ orders: OrderSummary[] }>('/orders');
  const [signingOut, setSigningOut] = useState(false);

  async function onLogout() {
    setSigningOut(true);
    try {
      await logout();
      navigate('/');
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="container page">
      <header className="page-head page-head-row">
        <div>
          <h1 className="page-title">Hello, {user!.name.split(' ')[0]}</h1>
          <p className="page-lede">{user!.email}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={onLogout} disabled={signingOut}>
          <Icon name="logout" size={18} /> Sign out
        </button>
      </header>

      <h2 className="section-title">Orders</h2>
      {orders.error ? (
        <ErrorState error={orders.error} onRetry={orders.reload} />
      ) : orders.loading ? (
        <Spinner label="Loading orders" />
      ) : orders.data!.orders.length === 0 ? (
        <EmptyState icon="box" title="No orders yet" action={<Link to="/shop" className="btn btn-dark">Browse the shop</Link>}>
          When you place an order it will appear here with its status.
        </EmptyState>
      ) : (
        <ul className="order-list">
          {orders.data!.orders.map((o) => (
            <li key={o.id}>
              <Link to={`/account/orders/${o.id}`} className="order-row">
                <span className="order-thumbs" aria-hidden="true">
                  {o.thumbnails?.map((t) => <img key={t} src={sized(t, 96)} alt="" />)}
                </span>
                <span className="order-meta">
                  <strong>{formatOrderNumber(o.id)}</strong>
                  <small>
                    {formatDate(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                  </small>
                </span>
                <StatusBadge status={o.status} />
                <span className="order-total">{formatMoney(o.totalCents)}</span>
                <Icon name="arrowRight" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OrderView({ order }: { order: Order }) {
  const a = order.address;
  return (
    <div className="order-detail">
      <div className="order-items">
        <ul className="cart-lines">
          {order.items.map((i) => (
            <li key={i.id} className="cart-line">
              <span className="cart-thumb">{i.imageUrl && <img src={sized(i.imageUrl, 200)} alt="" />}</span>
              <div className="cart-line-info">
                {i.slug ? (
                  <Link to={`/product/${i.slug}`} className="cart-line-name">
                    {i.productName}
                  </Link>
                ) : (
                  <span className="cart-line-name">{i.productName}</span>
                )}
                <span className="cart-line-variant">
                  {i.variantName} · SKU {i.sku}
                </span>
                <span className="cart-line-unit">
                  {formatMoney(i.unitPriceCents)} × {i.quantity}
                </span>
              </div>
              <span className="cart-line-total">{formatMoney(i.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
      </div>
      <aside className="summary">
        <h2 className="sub-title">Summary</h2>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotalCents)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>{order.shippingCents === 0 ? 'Free' : formatMoney(order.shippingCents)}</dd>
          </div>
          <div className="summary-total">
            <dt>Total</dt>
            <dd>{formatMoney(order.totalCents)}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>
              Pay on delivery · <StatusBadge status={order.paymentStatus} />
            </dd>
          </div>
        </dl>
        <h2 className="sub-title">Delivery</h2>
        <address className="address">
          {a.name}
          <br />
          {a.line1}
          {a.line2 && (
            <>
              <br />
              {a.line2}
            </>
          )}
          <br />
          {a.city}
          {a.region && `, ${a.region}`} {a.postal}
          <br />
          {a.country}
          <br />
          {a.phone}
        </address>
        {order.notes && <p className="summary-note">Note: {order.notes}</p>}
      </aside>
    </div>
  );
}

export function AccountOrder() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useApi<{ order: Order }>(`/orders/${encodeURIComponent(id)}`);

  if (loading) return <Spinner label="Loading order" />;
  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
    return (
      <div className="container page">
        <EmptyState title="Order not found" action={<Link to="/account" className="btn btn-dark">Your orders</Link>} />
      </div>
    );
  }
  if (error || !data) return <div className="container page"><ErrorState error={error} onRetry={reload} /></div>;
  const order = data.order;

  return (
    <div className="container page">
      <Breadcrumbs items={[{ to: '/account', label: 'Account' }, { label: formatOrderNumber(order.id) }]} />
      {params.get('placed') && (
        <Notice tone="success">
          Thank you, your order is in. We’ve reserved the items and will update the status here as it moves.
        </Notice>
      )}
      <header className="page-head page-head-row">
        <div>
          <h1 className="page-title">Order {formatOrderNumber(order.id)}</h1>
          <p className="page-lede">Placed {formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </header>
      <OrderView order={order} />
    </div>
  );
}
