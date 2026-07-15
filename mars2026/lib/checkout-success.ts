export const CHECKOUT_STATUS_POLL_DELAYS_MS = [
  750, 1_250, 2_000, 3_000, 5_000, 8_000,
] as const;

export type CheckoutPaymentState =
  | "paid"
  | "processing"
  | "failed"
  | "unverified";

export type CheckoutCartItem = {
  variantId: number;
  quantity: number;
};

type CheckoutOrderPayment = {
  paymentStatus: string | null;
  checkoutSessionId: string | null;
};

const CHECKOUT_SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9]+$/;

export function parseCheckoutOrderId(value: string) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const orderId = Number(value);

  return Number.isSafeInteger(orderId) ? orderId : null;
}

export function isValidCheckoutSessionId(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= 255 &&
    CHECKOUT_SESSION_ID_PATTERN.test(value)
  );
}

export function checkoutOrderIsPaid(
  order: CheckoutOrderPayment,
  expectedSessionId: string,
) {
  return (
    order.paymentStatus === "paid" &&
    order.checkoutSessionId === expectedSessionId
  );
}

export function paymentStateFromOrderStatus(
  paymentStatus: string,
  isPaid: boolean,
): CheckoutPaymentState {
  if (paymentStatus === "paid") {
    return isPaid ? "paid" : "unverified";
  }

  if (paymentStatus === "failed" || paymentStatus === "canceled") {
    return "failed";
  }

  return paymentStatus === "pending" ? "processing" : "unverified";
}

export function getCheckoutStatusPollDelay(attemptIndex: number) {
  if (!Number.isInteger(attemptIndex) || attemptIndex < 0) {
    return null;
  }

  return CHECKOUT_STATUS_POLL_DELAYS_MS[attemptIndex] ?? null;
}

export function subtractPurchasedCartItems(
  cartItems: CheckoutCartItem[],
  purchasedItems: CheckoutCartItem[],
) {
  const purchasedQuantities = new Map<number, number>();

  for (const item of purchasedItems) {
    if (
      Number.isInteger(item.variantId) &&
      item.variantId > 0 &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
    ) {
      purchasedQuantities.set(
        item.variantId,
        (purchasedQuantities.get(item.variantId) ?? 0) + item.quantity,
      );
    }
  }

  return cartItems.flatMap((item) => {
    const remainingQuantity =
      item.quantity - (purchasedQuantities.get(item.variantId) ?? 0);

    return remainingQuantity > 0
      ? [{ ...item, quantity: remainingQuantity }]
      : [];
  });
}
