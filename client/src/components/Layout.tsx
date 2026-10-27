import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Icon } from './Icon';

const NAV = [
  { to: '/shop', label: 'Shop all' },
  { to: '/shop?category=apparel', label: 'Apparel' },
  { to: '/shop?category=audio', label: 'Audio' },
  { to: '/shop?category=skincare', label: 'Skincare' },
  { to: '/shop?category=home', label: 'Home' },
];

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Hibir home">
      hibir<span className="logo-mark" aria-hidden="true" />
    </Link>
  );
}

function Header() {
  const { user } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  }

  const count = cart?.itemCount ?? 0;
  const isActive = (to: string) => `${location.pathname}${location.search}` === to;

  return (
    <header className="site-header">
      <div className="announce">
        <div className="container announce-inner">
          <span>
            <Icon name="truck" size={16} /> Free shipping on orders over $75
          </span>
          <span className="announce-sep" aria-hidden="true" />
          <span>
            <Icon name="wallet" size={16} /> Pay on delivery
          </span>
          <span className="announce-sep hide-sm" aria-hidden="true" />
          <span className="hide-sm">
            <Icon name="box" size={16} /> Stock shown is live
          </span>
        </div>
      </div>
      <div className="container header-inner">
        <button
          type="button"
          className="icon-btn menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
        <Logo />
        <nav id="primary-nav" className={`primary-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Primary">
          <ul>
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className={isActive(n.to) ? 'is-active' : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
            {user?.role === 'admin' && (
              <li>
                <NavLink to="/admin">Admin</NavLink>
              </li>
            )}
          </ul>
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Search products"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((o) => !o)}
          >
            <Icon name="search" />
          </button>
          <Link to={user ? '/account' : '/login'} className="icon-btn" aria-label={user ? 'Your account' : 'Sign in'}>
            <Icon name="user" />
          </Link>
          <Link to="/cart" className="icon-btn bag-btn" aria-label={`Bag, ${count} item${count === 1 ? '' : 's'}`}>
            <Icon name="bag" />
            {count > 0 && <span className="bag-count">{count > 99 ? '99+' : count}</span>}
          </Link>
        </div>
      </div>
      {searchOpen && (
        <div className="search-bar">
          <form className="container search-form" role="search" onSubmit={onSearch}>
            <Icon name="search" />
            <input
              autoFocus
              type="search"
              placeholder="Search products, e.g. hoodie or speaker"
              aria-label="Search products"
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-dark btn-sm">
              Search
            </button>
          </form>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Logo />
          <p className="footer-note">
            A small shop for things used every day: clothes, sound, skin, training, home and the bits you carry.
          </p>
        </div>
        <div>
          <h2 className="footer-heading">Shop</h2>
          <ul>
            <li><Link to="/shop?sort=newest">New in</Link></li>
            <li><Link to="/shop?category=fitness">Fitness</Link></li>
            <li><Link to="/shop?category=accessories">Accessories</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="footer-heading">Account</h2>
          <ul>
            <li><Link to="/account">Orders</Link></li>
            <li><Link to="/cart">Bag</Link></li>
            <li><Link to="/login">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="footer-heading">About this site</h2>
          <p className="footer-note">
            Hibir is a portfolio project, not a real retailer. Nothing is for sale and no payment is taken. Product
            photography is from <a href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash</a>, credited on each product page.
          </p>
        </div>
      </div>
      <div className="container footer-base">
        <span>© {new Date().getFullYear()} Hibir demo store</span>
      </div>
    </footer>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
