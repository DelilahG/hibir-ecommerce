import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Spinner } from './ui';

export function RequireUser() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

/** Hides admin screens from customers. The API enforces the same rule independently. */
export function RequireAdmin() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (user.role !== 'admin') {
    return (
      <div className="container page">
        <EmptyState icon="shield" title="Staff only" action={<Link to="/" className="btn btn-dark">Back to the shop</Link>}>
          Your account doesn’t have access to the admin area.
        </EmptyState>
      </div>
    );
  }
  return <Outlet />;
}
