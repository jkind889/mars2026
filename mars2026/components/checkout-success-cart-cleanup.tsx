"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/components/cart-provider";
import type { CheckoutCartItem } from "@/lib/checkout-success";

const CLEANED_ORDERS_STORAGE_KEY = "mars-cart-cleaned-orders-v1";

export function CheckoutSuccessCartCleanup({
  cleanupId,
  purchasedItems,
  shouldClear,
}: {
  cleanupId: string | null;
  purchasedItems: CheckoutCartItem[];
  shouldClear: boolean;
}) {
  const { isHydrated, removePurchasedItems } = useCart();
  const cleanedInThisMount = useRef(false);

  useEffect(() => {
    if (
      !shouldClear ||
      !isHydrated ||
      !cleanupId ||
      !purchasedItems.length ||
      cleanedInThisMount.current
    ) {
      return;
    }

    let cleanedOrderIds: string[] = [];

    try {
      const storedValue = window.localStorage.getItem(
        CLEANED_ORDERS_STORAGE_KEY,
      );
      const parsedValue: unknown = storedValue ? JSON.parse(storedValue) : [];
      cleanedOrderIds = Array.isArray(parsedValue)
        ? parsedValue.filter((value): value is string => typeof value === "string")
        : [];

      if (cleanedOrderIds.includes(cleanupId)) {
        cleanedInThisMount.current = true;
        return;
      }
    } catch {
      // The in-memory cleanup below still keeps this page correct.
    }

    removePurchasedItems(purchasedItems);
    cleanedInThisMount.current = true;

    try {
      const nextCleanedOrderIds = [
        ...cleanedOrderIds.filter((value) => value !== cleanupId).slice(-49),
        cleanupId,
      ];
      window.localStorage.setItem(
        CLEANED_ORDERS_STORAGE_KEY,
        JSON.stringify(nextCleanedOrderIds),
      );
    } catch {
      // Keep cart cleanup usable if browser storage is unavailable.
    }
  }, [
    cleanupId,
    isHydrated,
    purchasedItems,
    removePurchasedItems,
    shouldClear,
  ]);

  return null;
}
