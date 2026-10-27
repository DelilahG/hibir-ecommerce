import { NavLink, Outlet } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';

const LINKS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/admin', label: 'Overview', icon: 'chart', end: true },
  { to: '/admin/orders', label: 'Orders', icon: 'list' },
  { to: '/admin/products', label: 'Products', icon: 'tag' },
  { to: '/admin/categories', label: 'Categories', icon: 'grid' },
];

export function AdminLayout() {
  return (
    <div className="container admin">
      <nav className="admin-nav" aria-label="Admin">
        <p className="eyebrow">Store admin</p>
        <ul>
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.end}>
                <Icon name={l.icon} size={18} /> {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}
