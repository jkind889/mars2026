const MAX_CART_LINES = 50;
const MAX_QUANTITY = 99;
const CHECKOUT_ATTEMPT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CheckoutPublicError extends Error {
  readonly status: number;
  readonly resetCheckoutAttempt: boolean;

  constructor(
    message: string,
    status = 500,
    resetCheckoutAttempt = false,
  ) {
    super(message);
    this.name = "CheckoutPublicError";
    this.status = status;
    this.resetCheckoutAttempt = resetCheckoutAttempt;
  }
}

export type CartItem = {
  variantId: number;
  quantity: number;
};

export function normalizeCheckoutAttemptId(value: unknown) {
  if (
    typeof value !== "string" ||
    !CHECKOUT_ATTEMPT_ID_PATTERN.test(value)
  ) {
    throw new CheckoutPublicError(
      "Checkout received an invalid attempt identifier. Refresh and try again.",
      400,
      true,
    );
  }

  return value.toLowerCase();
}

export function normalizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error("Your cart is empty.");
  }

  const quantities = new Map<number, number>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error("Your cart contains an invalid item.");
    }

    const candidate = item as {
      variantId?: unknown;
      quantity?: unknown;
    };

    if (
      typeof candidate.variantId !== "number" ||
      !Number.isInteger(candidate.variantId) ||
      candidate.variantId <= 0 ||
      typeof candidate.quantity !== "number" ||
      !Number.isInteger(candidate.quantity) ||
      candidate.quantity <= 0
    ) {
      throw new Error("Your cart contains an invalid item or quantity.");
    }

    const quantity =
      (quantities.get(candidate.variantId) ?? 0) + candidate.quantity;

    if (quantity > MAX_QUANTITY) {
      throw new Error(
        `You can purchase at most ${MAX_QUANTITY} of one poster size.`,
      );
    }

    quantities.set(candidate.variantId, quantity);
  }

  if (quantities.size > MAX_CART_LINES) {
    throw new Error(`Your cart can contain at most ${MAX_CART_LINES} items.`);
  }

  return Array.from(quantities, ([variantId, quantity]) => ({
    variantId,
    quantity,
  }));
}

export function createOrderNumber(checkoutAttemptId: string) {
  return `marsord-${checkoutAttemptId}`;
}

export function isStripeResourceMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const stripeError = error as { code?: unknown; statusCode?: unknown };
  return (
    stripeError.code === "resource_missing" || stripeError.statusCode === 404
  );
}

export function isIndeterminateStripeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const stripeError = error as { type?: unknown; statusCode?: unknown };
  return (
    stripeError.type === "StripeConnectionError" ||
    stripeError.type === "StripeAPIError" ||
    stripeError.type === "StripeIdempotencyError" ||
    (typeof stripeError.statusCode === "number" &&
      stripeError.statusCode >= 500)
  );
}

export function stripePriceMatchesVariant(
  price: {
    active: boolean;
    currency: string;
    type: string;
    unit_amount: number | null;
  },
  variant: {
    currency: string;
    price_cents: number;
  },
) {
  return (
    price.active &&
    price.type === "one_time" &&
    price.unit_amount === variant.price_cents &&
    price.currency.toLowerCase() === variant.currency.toLowerCase()
  );
}

export function checkoutSessionMatchesOrder(
  session: {
    amountSubtotal: number | null;
    clientReferenceId: string | null;
    currency: string | null;
    customerId: string | null;
    id: string;
    metadataUserId: string | undefined;
    mode: string;
  },
  order: {
    checkoutSessionId: string | null;
    currency: string | null;
    customerId: string | null;
    subtotalCents: number | null;
    userId: string | null;
  },
) {
  return (
    session.mode === "payment" &&
    order.userId !== null &&
    order.customerId !== null &&
    order.currency !== null &&
    order.subtotalCents !== null &&
    session.currency !== null &&
    session.amountSubtotal !== null &&
    session.clientReferenceId === order.userId &&
    session.metadataUserId === order.userId &&
    session.customerId === order.customerId &&
    session.amountSubtotal === order.subtotalCents &&
    session.currency?.toLowerCase() === order.currency?.toLowerCase() &&
    (!order.checkoutSessionId || order.checkoutSessionId === session.id)
  );
}
