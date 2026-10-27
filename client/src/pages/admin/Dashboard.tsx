import { Link } from 'react-router-dom';
import { ErrorState, Spinner, StatusBadge } from '../../components/ui';
import { formatDate, formatMoney, formatOrderNumber, statusLabel } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface Summary {
  ordersByStatus: Record<string, number>;
  paidCents: number;
  outstandingCents: number;
  products: { active: number; inactive: number };
  lowStock: { id: number; sku: string; variantName: string; stock: number; productId: number; productName: string }[];
  lowStockThreshold: number;
  recentOrders: { id: number; status: string; paymentStatus: string; totalCents: number; createdAt: string; customerName: string }[];
}

export function Dashboard() {
  const { data, error, loading, reload } = useApi<Summary>('/admin/summary');
  if (loading) return <Spinner label="Loading overview" />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const open = data.ordersByStatus.pending + data.ordersByStatus.processing;

  return (
    <>
      <h1 className="page-title">Overview</h1>
      <div className="stats">
        <div className="stat">
          <span className="stat-label">Orders to fulfil</span>
          <span className="stat-value">{open}</span>
          <Link to="/admin/orders?status=pending" className="text-link">View pending</Link>
        </div>
        <div className="stat">
          <span className="stat-label">Payments received</span>
          <span className="stat-value">{formatMoney(data.paidCents)}</span>
          <span className="stat-note">Orders marked paid</span>
        </div>
        <div className="stat">
          <span className="stat-label">Awaiting payment</span>
          <span className="stat-value">{formatMoney(data.outstandingCents)}</span>
          <span className="stat-note">Unpaid, not cancelled</span>
        </div>
        <div className="stat">
          <span className="stat-label">Live products</span>
          <span className="stat-value">{data.products.active}</span>
          <span className="stat-note">{data.products.inactive} hidden</span>
        </div>
      </div>

      <div className="admin-columns">
        <section className="panel">
          <h2 className="sub-title">Orders by status</h2>
          <dl className="status-list">
            {Object.entries(data.ordersByStatus).map(([s, n]) => (
              <div key={s}>
                <dt>
                  <Link to={`/admin/orders?status=${s}`}>{statusLabel[s]}</Link>
                </dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="panel">
          <h2 className="sub-title">Low stock (≤ {data.lowStockThreshold})</h2>
          {data.lowStock.length === 0 ? (
            <p className="muted">Every live variant has more than {data.lowStockThreshold} units.</p>
          ) : (
            <ul className="plain-list">
              {data.lowStock.map((v) => (
                <li key={v.id}>
                  <Link to={`/admin/products/${v.productId}`}>
                    {v.productName} <span className="muted">· {v.variantName}</span>
                  </Link>
                  <strong className={v.stock === 0 ? 'text-danger' : ''}>{v.stock}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <h2 className="sub-title">Latest orders</h2>
        {data.recentOrders.length === 0 ? (
          <p className="muted">No orders have been placed yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/admin/orders/${o.id}`}>{formatOrderNumber(o.id)}</Link></td>
                    <td>{o.customerName}</td>
                    <td>{formatDate(o.createdAt)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="num">{formatMoney(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
