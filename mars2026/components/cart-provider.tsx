"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { subtractPurchasedCartItems } from "@/lib/checkout-success";

const STORAGE_KEY = "mars-cart-v1";
const MAX_QUANTITY = 99;

export type CartItem = {
  variantId: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  isHydrated: boolean;
  addItem: (variantId: number, quantity?: number) => void;
  updateQuantity: (variantId: number, quantity: number) => void;
  removeItem: (variantId: number) => void;
  removePurchasedItems: (purchasedItems: CartItem[]) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function normalizeItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = new Map<number, number>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as {
      variantId?: unknown;
      quantity?: unknown;
    };
    const variantId = Number(candidate.variantId);
    const quantity = Math.floor(Number(candidate.quantity));

    if (!Number.isInteger(variantId) || variantId <= 0 || quantity <= 0) {
      continue;
    }

    const currentQuantity = normalized.get(variantId) ?? 0;
    normalized.set(
      variantId,
      Math.min(MAX_QUANTITY, currentQuantity + quantity),
    );
  }

  return Array.from(normalized, ([variantId, quantity]) => ({
    variantId,
    quantity,
  }));
}

function cartItemsEqual(left: CartItem[], right: CartItem[]) {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.variantId === right[index]?.variantId &&
        item.quantity === right[index]?.quantity,
    )
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedCart = window.localStorage.getItem(STORAGE_KEY);
      setItems(storedCart ? normalizeItems(JSON.parse(storedCart)) : []);
    } catch {
      setItems([]);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      let nextItems: CartItem[];

      try {
        nextItems = event.newValue
          ? normalizeItems(JSON.parse(event.newValue))
          : [];
      } catch {
        nextItems = [];
      }

      setItems((currentItems) =>
        cartItemsEqual(currentItems, nextItems) ? currentItems : nextItems,
      );
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Keep the in-memory cart usable if browser storage is unavailable.
    }
  }, [items, isHydrated]);

  const addItem = useCallback((variantId: number, quantity = 1) => {
    setItems((currentItems) =>
      normalizeItems([...currentItems, { variantId, quantity }]),
    );
  }, []);

  const updateQuantity = useCallback((variantId: number, quantity: number) => {
    setItems((currentItems) =>
      normalizeItems(
        currentItems.map((item) =>
          item.variantId === variantId ? { ...item, quantity } : item,
        ),
      ),
    );
  }, []);

  const removeItem = useCallback((variantId: number) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.variantId !== variantId),
    );
  }, []);

  const removePurchasedItems = useCallback((purchasedItems: CartItem[]) => {
    setItems((currentItems) =>
      subtractPurchasedCartItems(currentItems, purchasedItems),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      isHydrated,
      addItem,
      updateQuantity,
      removeItem,
      removePurchasedItems,
      clearCart,
    }),
    [
      items,
      isHydrated,
      addItem,
      updateQuantity,
      removeItem,
      removePurchasedItems,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within a CartProvider.");
  }

  return context;
}
