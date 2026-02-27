import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type CartProductJoin = {
  id: string;
  name: string;
  customer_price: number;
  thumbnail_url: string | null;
  images: string[] | null;
};

type CartVariantJoin = {
  id: string;
  name: string;
};

type CartDbRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  product: CartProductJoin | null;
  variant: CartVariantJoin | null;
};

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  image: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = 'auracart-cart';

const mapDbRowsToCartItems = (rows: CartDbRow[]): CartItem[] => rows
  .filter((row) => row.product)
  .map((row) => ({
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id || undefined,
    name: row.product?.name || 'Product',
    variantName: row.variant?.name || undefined,
    price: row.product?.customer_price || 0,
    image: row.product?.thumbnail_url || row.product?.images?.[0] || '',
    quantity: row.quantity,
  }));

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  const [isOpen, setIsOpen] = useState(false);

  const loadCartFromDatabase = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('cart_items')
      .select('id, product_id, variant_id, quantity, product:products!cart_items_product_id_fkey(id,name,customer_price,thumbnail_url,images), variant:product_variants!cart_items_variant_id_fkey(id,name)')
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to load cart from database:', error);
      return;
    }

    setItems(mapDbRowsToCartItems((data || []) as unknown as CartDbRow[]));
  }, [user]);

  const syncSnapshotToDatabase = useCallback(async (nextItems: CartItem[]) => {
    if (!user) return;

    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Failed to clear previous cart snapshot:', deleteError);
      return;
    }

    if (nextItems.length === 0) return;

    const payload = nextItems.map((item) => ({
      user_id: user.id,
      product_id: item.productId,
      variant_id: item.variantId || null,
      quantity: item.quantity,
    }));

    const { error: insertError } = await supabase
      .from('cart_items')
      .insert(payload);

    if (insertError) {
      console.error('Failed to persist cart snapshot:', insertError);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      setItems(stored ? JSON.parse(stored) : []);
      return;
    }

    const bootstrap = async () => {
      const localItems = localStorage.getItem(CART_STORAGE_KEY);
      if (localItems) {
        const parsed = JSON.parse(localItems) as CartItem[];
        if (parsed.length > 0) {
          await syncSnapshotToDatabase(parsed);
          localStorage.removeItem(CART_STORAGE_KEY);
        }
      }
      await loadCartFromDatabase();
    };

    bootstrap();
  }, [user, loadCartFromDatabase, syncSnapshotToDatabase]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, user]);

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.productId === item.productId && i.variantId === item.variantId,
      );

      let next: CartItem[];
      if (existingIndex > -1) {
        next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + item.quantity,
        };
      } else {
        next = [...prev, { ...item, id: crypto.randomUUID() }];
      }

      void syncSnapshotToDatabase(next);
      return next;
    });
    setIsOpen(true);
  }, [syncSnapshotToDatabase]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      void syncSnapshotToDatabase(next);
      return next;
    });
  }, [syncSnapshotToDatabase]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }

    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, quantity } : item));
      void syncSnapshotToDatabase(next);
      return next;
    });
  }, [removeItem, syncSnapshotToDatabase]);

  const clearCart = useCallback(() => {
    setItems([]);
    void syncSnapshotToDatabase([]);
  }, [syncSnapshotToDatabase]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      items,
      isOpen,
      setIsOpen,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      subtotal,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
