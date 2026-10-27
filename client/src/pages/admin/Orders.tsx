import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Breadcrumbs, EmptyState, ErrorState, Notice, Spinner, StatusBadge } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDate, formatMoney, formatOrderNumber, statusLabel } from '../../lib/format';
import type { Order, OrderSummary, PaymentStatus } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { OrderView } from '../Account';

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = new URLSearchParams({ page: String(page) });
  if (status) q.set('status', status);
  const { data, error, loading, reload } = useApi<{ orders: OrderSummary[]; page: number; pages: number }>(`/admin/orders?${q}`);

  return (
    <>
      <h1 className="page-title">Orders</h1>
      <div className="chip-row" role="group" aria-label="Filter by status">
        {['', ...STATUSES].map((s) => (
          <button key={s || 'all'} type="button" className={`chip ${status === s ? 'is-active' : ''}`} aria-pressed={status === s} onClick={() => setParams(s ? { status: s } : {})}>
            {s ? statusLabel[s] : 'All'}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <Spinner label="Loading orders" />
      ) : data!.orders.length === 0 ? (
        <EmptyState icon="list" title="No orders here" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data!.orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/admin/orders/${o.id}`}>{formatOrderNumber(o.id)}</Link></td>
                    <td>
                      {o.customerName}
                      <br />
                      <small className="muted">{o.customerEmail}</small>
                    </td>
                    <td>{formatDate(o.createdAt)}</td>
                    <td>{o.itemCount}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><StatusBadge status={o.paymentStatus} /></td>
                    <td className="num">{formatMoney(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data!.pages > 1 && (
            <nav className="pagination" aria-label="Pagination">
              <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setParams({ ...(status && { status }), page: String(page - 1) })}>Previous</button>
              <span>Page {page} of {data!.pages}</span>
              <button type="button" className="btn btn-outline btn-sm" disabled={page >= data!.pages} onClick={() => setParams({ ...(status && { status }), page: String(page + 1) })}>Next</button>
            </nav>
          )}
        </>
      )}
    </>
  );
}

const ACTION_LABEL: Record<string, string> = {
  processing: 'Start preparing',
  shipped: 'Mark shipped',
  delivered: 'Mark delivered',
  cancelled: 'Cancel order',
};

export function AdminOrder() {
  const { id = '' } = useParams();
  const { data, error, loading, reload, setData } = useApi<{ order: Order; nextStatuses: string[] }>(`/admin/orders/${encodeURIComponent(id)}`);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  if (loading) return <Spinner label="Loading order" />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const { order, nextStatuses } = data;

  async function patch(body: { status?: string; paymentStatus?: PaymentStatus }) {
    if (body.status === 'cancelled' && !window.confirm('Cancel this order? Reserved stock will be returned to inventory.')) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ order: Order; nextStatuses: string[] }>(`/admin/orders/${order.id}`, { method: 'PATCH', body });
      setData(r);
      setMessage({ tone: 'success', text: 'Order updated.' });
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Breadcrumbs items={[{ to: '/admin/orders', label: 'Orders' }, { label: formatOrderNumber(order.id) }]} />
      <header className="page-head page-head-row">
        <div>
          <h1 className="page-title">{formatOrderNumber(order.id)}</h1>
          <p className="page-lede">
            {order.customer.name} · {order.customer.email} · {formatDate(order.createdAt)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </header>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className="panel admin-actions">
        <div>
          <h2 className="sub-title">Fulfilment</h2>
          {nextStatuses.length === 0 ? (
            <p className="muted">This order is {statusLabel[order.status].toLowerCase()}; no further changes.</p>
          ) : (
            <div className="btn-row">
              {nextStatuses.map((s) => (
                <button key={s} type="button" className={`btn btn-sm ${s === 'cancelled' ? 'btn-outline btn-danger' : 'btn-dark'}`} disabled={busy} onClick={() => patch({ status: s })}>
                  {ACTION_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="field field-inline">
          <span>Payment status</span>
          <select value={order.paymentStatus} disabled={busy} onChange={(e) => patch({ paymentStatus: e.target.value as PaymentStatus })}>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
      </div>
      <OrderView order={order} />
    </>
  );
}
