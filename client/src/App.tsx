import { Link, Route, Routes } from 'react-router-dom';
import { RequireAdmin, RequireUser } from './components/Guards';
import { Layout } from './components/Layout';
import { EmptyState } from './components/ui';
import { Account, AccountOrder } from './pages/Account';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminCategories } from './pages/admin/Categories';
import { Dashboard } from './pages/admin/Dashboard';
import { AdminOrder, AdminOrders } from './pages/admin/Orders';
import { ProductEditor } from './pages/admin/ProductEditor';
import { AdminProducts } from './pages/admin/Products';
import { Auth } from './pages/Auth';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Home } from './pages/Home';
import { Product } from './pages/Product';
import { Shop } from './pages/Shop';

function NotFound() {
  return (
    <div className="container page">
      <EmptyState icon="search" title="Page not found" action={<Link to="/" className="btn btn-dark">Go to the homepage</Link>}>
        The page you were looking for doesn’t exist.
      </EmptyState>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="product/:slug" element={<Product />} />
        <Route path="cart" element={<Cart />} />
        <Route path="login" element={<Auth mode="login" />} />
        <Route path="register" element={<Auth mode="register" />} />
        <Route element={<RequireUser />}>
          <Route path="checkout" element={<Checkout />} />
          <Route path="account" element={<Account />} />
          <Route path="account/orders/:id" element={<AccountOrder />} />
        </Route>
        <Route path="admin" element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrder />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<ProductEditor />} />
            <Route path="products/:id" element={<ProductEditor />} />
            <Route path="categories" element={<AdminCategories />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
