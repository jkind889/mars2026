import assert from "node:assert/strict";
import test from "node:test";

import {
  checkoutOrderIsPaid,
  getCheckoutStatusPollDelay,
  isValidCheckoutSessionId,
  parseCheckoutOrderId,
  paymentStateFromOrderStatus,
  subtractPurchasedCartItems,
} from "./checkout-success";

const SESSION_ID = "cs_test_a1B2c3D4";

test("checkout status inputs only accept real-looking positive IDs", () => {
  assert.equal(parseCheckoutOrderId("42"), 42);
  assert.equal(parseCheckoutOrderId("0"), null);
  assert.equal(parseCheckoutOrderId("42.5"), null);
  assert.equal(parseCheckoutOrderId("not-an-order"), null);

  assert.equal(isValidCheckoutSessionId(SESSION_ID), true);
  assert.equal(isValidCheckoutSessionId("cs_test_"), false);
  assert.equal(isValidCheckoutSessionId("pi_test_a1B2c3D4"), false);
  assert.equal(isValidCheckoutSessionId([SESSION_ID]), false);
});

test("paid checkout state requires both the DB status and matching Session ID", () => {
  assert.equal(
    checkoutOrderIsPaid(
      { paymentStatus: "paid", checkoutSessionId: SESSION_ID },
      SESSION_ID,
    ),
    true,
  );
  assert.equal(
    checkoutOrderIsPaid(
      { paymentStatus: "paid", checkoutSessionId: "cs_test_other" },
      SESSION_ID,
    ),
    false,
  );
  assert.equal(
    checkoutOrderIsPaid(
      { paymentStatus: "pending", checkoutSessionId: SESSION_ID },
      SESSION_ID,
    ),
    false,
  );
});

test("order statuses map to fail-closed success states", () => {
  assert.equal(paymentStateFromOrderStatus("paid", true), "paid");
  assert.equal(paymentStateFromOrderStatus("paid", false), "unverified");
  assert.equal(paymentStateFromOrderStatus("pending", false), "processing");
  assert.equal(paymentStateFromOrderStatus("failed", false), "failed");
  assert.equal(paymentStateFromOrderStatus("canceled", false), "failed");
  assert.equal(paymentStateFromOrderStatus("refunded", false), "unverified");
});

test("checkout polling uses bounded increasing delays", () => {
  const delays = Array.from({ length: 6 }, (_, index) =>
    getCheckoutStatusPollDelay(index),
  );

  assert.deepEqual(delays, [750, 1_250, 2_000, 3_000, 5_000, 8_000]);
  assert.equal(getCheckoutStatusPollDelay(delays.length), null);
  assert.equal(getCheckoutStatusPollDelay(-1), null);
});

test("paid checkout cleanup subtracts purchased quantities only", () => {
  assert.deepEqual(
    subtractPurchasedCartItems(
      [
        { variantId: 7, quantity: 3 },
        { variantId: 9, quantity: 1 },
      ],
      [{ variantId: 7, quantity: 2 }],
    ),
    [
      { variantId: 7, quantity: 1 },
      { variantId: 9, quantity: 1 },
    ],
  );

  assert.deepEqual(
    subtractPurchasedCartItems(
      [{ variantId: 7, quantity: 2 }],
      [{ variantId: 7, quantity: 2 }],
    ),
    [],
  );
});
