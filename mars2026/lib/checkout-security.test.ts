import assert from "node:assert/strict";
import test from "node:test";
import {
  CheckoutPublicError,
  checkoutSessionMatchesOrder,
  createOrderNumber,
  isIndeterminateStripeError,
  isStripeResourceMissing,
  normalizeCartItems,
  normalizeCheckoutAttemptId,
  stripePriceMatchesVariant,
} from "./checkout-security";

const ATTEMPT_ID = "550e8400-e29b-41d4-a716-446655440000";

test("checkout attempt IDs are normalized and become stable order numbers", () => {
  const normalized = normalizeCheckoutAttemptId(ATTEMPT_ID.toUpperCase());

  assert.equal(normalized, ATTEMPT_ID);
  assert.equal(createOrderNumber(normalized), `marsord-${ATTEMPT_ID}`);
});

test("invalid checkout attempt IDs tell the client to reset", () => {
  assert.throws(
    () => normalizeCheckoutAttemptId("not-a-uuid"),
    (error) =>
      error instanceof CheckoutPublicError &&
      error.status === 400 &&
      error.resetCheckoutAttempt,
  );
});

test("cart normalization combines duplicate variants and rejects overflow", () => {
  assert.deepEqual(
    normalizeCartItems([
      { variantId: 7, quantity: 2 },
      { variantId: 7, quantity: 3 },
      { variantId: 9, quantity: 1 },
    ]),
    [
      { variantId: 7, quantity: 5 },
      { variantId: 9, quantity: 1 },
    ],
  );

  assert.throws(
    () =>
      normalizeCartItems([
        { variantId: 7, quantity: 99 },
        { variantId: 7, quantity: 1 },
      ]),
    /at most 99/,
  );
});

test("Stripe errors distinguish missing resources from ambiguous results", () => {
  assert.equal(isStripeResourceMissing({ code: "resource_missing" }), true);
  assert.equal(isStripeResourceMissing({ statusCode: 404 }), true);
  assert.equal(
    isIndeterminateStripeError({ type: "StripeConnectionError" }),
    true,
  );
  assert.equal(
    isIndeterminateStripeError({ type: "StripeAPIError", statusCode: 500 }),
    true,
  );
  assert.equal(
    isIndeterminateStripeError({
      type: "StripeInvalidRequestError",
      statusCode: 400,
    }),
    false,
  );
});

test("Stripe Prices must match the active one-time database price", () => {
  const variant = { currency: "usd", price_cents: 3500 };
  const validPrice = {
    active: true,
    currency: "usd",
    type: "one_time",
    unit_amount: 3500,
  };

  assert.equal(stripePriceMatchesVariant(validPrice, variant), true);
  assert.equal(
    stripePriceMatchesVariant({ ...validPrice, unit_amount: 3600 }, variant),
    false,
  );
  assert.equal(
    stripePriceMatchesVariant({ ...validPrice, active: false }, variant),
    false,
  );
  assert.equal(
    stripePriceMatchesVariant({ ...validPrice, currency: "cad" }, variant),
    false,
  );
});

test("webhook Checkout Sessions must match the complete pending order identity", () => {
  const session = {
    amountSubtotal: 3500,
    clientReferenceId: "user-1",
    currency: "usd",
    customerId: "cus_123",
    id: "cs_123",
    metadataUserId: "user-1",
    mode: "payment",
  };
  const order = {
    checkoutSessionId: null,
    currency: "USD",
    customerId: "cus_123",
    subtotalCents: 3500,
    userId: "user-1",
  };

  assert.equal(checkoutSessionMatchesOrder(session, order), true);
  assert.equal(
    checkoutSessionMatchesOrder(
      { ...session, customerId: "cus_wrong" },
      order,
    ),
    false,
  );
  assert.equal(
    checkoutSessionMatchesOrder({ ...session, amountSubtotal: 3400 }, order),
    false,
  );
  assert.equal(
    checkoutSessionMatchesOrder(session, {
      ...order,
      checkoutSessionId: "cs_other",
    }),
    false,
  );
});
