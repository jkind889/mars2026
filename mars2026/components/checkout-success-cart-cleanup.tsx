"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart-provider";

export function CheckoutSuccessCartCleanup({
  shouldClear,
}: {
  shouldClear: boolean;
}) {
  const { clearCart, isHydrated } = useCart();

  useEffect(() => {
    if (shouldClear && isHydrated) {
      clearCart();
    }
  }, [clearCart, isHydrated, shouldClear]);

  return null;
}
