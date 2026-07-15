"use client";

import { useEffect, useState } from "react";

import { CheckoutSuccessCartCleanup } from "@/components/checkout-success-cart-cleanup";
import {
  getCheckoutStatusPollDelay,
  paymentStateFromOrderStatus,
  type CheckoutCartItem,
  type CheckoutPaymentState,
} from "@/lib/checkout-success";

type CheckoutSuccessStatusProps = {
  initialPaymentState: CheckoutPaymentState;
  initialOrderNumber: string | null;
  orderId: number | null;
  purchasedItems: CheckoutCartItem[];
  sessionId: string | null;
};

type OrderStatusResponse = {
  orderNumber: string | null;
  paymentStatus: string;
  isPaid: boolean;
};

function isOrderStatusResponse(value: unknown): value is OrderStatusResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const status = value as Partial<OrderStatusResponse>;

  return (
    (typeof status.orderNumber === "string" || status.orderNumber === null) &&
    typeof status.paymentStatus === "string" &&
    typeof status.isPaid === "boolean"
  );
}

const STATUS_COPY: Record<
  CheckoutPaymentState,
  { heading: string; description: string }
> = {
  paid: {
    heading: "Thanks for your order.",
    description:
      "Your payment and order are confirmed. The purchased items were removed from your cart.",
  },
  processing: {
    heading: "Your payment is processing.",
    description:
      "We are waiting for the secure payment notification to update your order. Your cart will remain available until it is confirmed.",
  },
  failed: {
    heading: "Your payment was not completed.",
    description:
      "Your order was not paid, so your cart has not been cleared. You can return to it and try again.",
  },
  unverified: {
    heading: "We could not verify this checkout.",
    description:
      "Your cart has not been cleared. Check your orders before trying the payment again.",
  },
};

export function CheckoutSuccessStatus({
  initialPaymentState,
  initialOrderNumber,
  orderId,
  purchasedItems,
  sessionId,
}: CheckoutSuccessStatusProps) {
  const [paymentState, setPaymentState] =
    useState<CheckoutPaymentState>(initialPaymentState);
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [pollingExhausted, setPollingExhausted] = useState(false);

  useEffect(() => {
    if (paymentState !== "processing" || !orderId || !sessionId) {
      return;
    }

    const checkoutOrderId = orderId;
    const checkoutSessionId = sessionId;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attemptIndex = 0;

    function scheduleNextPoll() {
      if (controller.signal.aborted) {
        return;
      }

      const delay = getCheckoutStatusPollDelay(attemptIndex);

      if (delay === null) {
        setPollingExhausted(true);
        return;
      }

      attemptIndex += 1;
      timeoutId = setTimeout(pollOrderStatus, delay);
    }

    async function pollOrderStatus() {
      try {
        const response = await fetch(
          `/api/orders/${checkoutOrderId}/status?session_id=${encodeURIComponent(checkoutSessionId)}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          },
        );

        if (response.redirected) {
          setPaymentState("unverified");
          return;
        }

        if (!response.ok) {
          if ([400, 401, 403, 404].includes(response.status)) {
            setPaymentState("unverified");
            return;
          }

          scheduleNextPoll();
          return;
        }

        const status: unknown = await response.json();

        if (!isOrderStatusResponse(status)) {
          setPaymentState("unverified");
          return;
        }

        setOrderNumber(status.orderNumber);

        const nextPaymentState = paymentStateFromOrderStatus(
          status.paymentStatus,
          status.isPaid,
        );

        if (nextPaymentState === "processing") {
          scheduleNextPoll();
          return;
        }

        setPaymentState(nextPaymentState);
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        scheduleNextPoll();
      }
    }

    scheduleNextPoll();

    return () => {
      controller.abort();

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [orderId, paymentState, sessionId]);

  const copy = STATUS_COPY[paymentState];

  return (
    <>
      <CheckoutSuccessCartCleanup
        cleanupId={orderId ? `order-${orderId}` : null}
        purchasedItems={purchasedItems}
        shouldClear={paymentState === "paid"}
      />

      <div aria-atomic="true" aria-live="polite" role="status">
        <h1 className="mt-3 text-3xl font-semibold">{copy.heading}</h1>
        <p className="mt-4 text-muted-foreground">{copy.description}</p>

        {paymentState === "processing" && pollingExhausted ? (
          <p className="mt-3 text-sm text-muted-foreground">
            This is taking longer than expected. You can refresh this page or
            check your orders; your cart will stay intact in the meantime.
          </p>
        ) : null}

        {orderNumber ? (
          <p className="mt-4 rounded border p-3 text-sm text-muted-foreground">
            Order: {orderNumber}
          </p>
        ) : null}
      </div>
    </>
  );
}
