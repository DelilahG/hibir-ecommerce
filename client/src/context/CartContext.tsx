import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Cart } from '../lib/types';
import { useAuth } from './AuthContext';

interface CartValue {
  cart: Cart | null;
  loading: boolean;
  add: (variantId: number, quantity?: number) => Promise<void>;
  setQuantity: (variantId: number, quantity: number) => Promise<void>;
  remove: (variantId: number) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ cart: Cart }>('/cart');
      setCart(r.cart);
    } finally {
      setLoading(false);
    }
  }, []);

  // The server merges a guest bag into the account on sign-in, so reload whenever the user changes.
  useEffect(() => {
    if (ready) refresh().catch(() => {});
  }, [ready, user?.id, refresh]);

  const add = useCallback(async (variantId: number, quantity = 1) => {
    const r = await api<{ cart: Cart }>('/cart/items', { method: 'POST', body: { variantId, quantity } });
    setCart(r.cart);
  }, []);

  const setQuantity = useCallback(async (variantId: number, quantity: number) => {
    const r = await api<{ cart: Cart }>(`/cart/items/${variantId}`, { method: 'PATCH', body: { quantity } });
    setCart(r.cart);
  }, []);

  const remove = useCallback(async (variantId: number) => {
    const r = await api<{ cart: Cart }>(`/cart/items/${variantId}`, { method: 'DELETE' });
    setCart(r.cart);
  }, []);

  const clear = useCallback(() => setCart((c) => (c ? { ...c, items: [], itemCount: 0, subtotalCents: 0, shippingCents: 0, totalCents: 0, hasIssues: false } : c)), []);

  const value = useMemo(
    () => ({ cart, loading, add, setQuantity, remove, refresh, clear }),
    [cart, loading, add, setQuantity, remove, refresh, clear],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
