import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckoutSuccessStatus } from "@/components/checkout-success-status";
import {
  checkoutOrderIsPaid,
  isValidCheckoutSessionId,
  parseCheckoutOrderId,
  paymentStateFromOrderStatus,
  type CheckoutCartItem,
  type CheckoutPaymentState,
} from "@/lib/checkout-success";
import { createStripeClient } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

type CheckoutSuccessPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

type CheckoutSuccessOrderRow = {
  id: number;
  order_number: string;
  payment_status: string | null;
  stripe_checkout_session_id: string | null;
  order_items: Array<{
    variant_id: number | null;
    quantity: number | null;
  }>;
};

function purchasedCartItems(orderItems: CheckoutSuccessOrderRow["order_items"]) {
  const quantities = new Map<number, number>();

  for (const item of orderItems) {
    if (
      Number.isInteger(item.variant_id) &&
      (item.variant_id ?? 0) > 0 &&
      Number.isInteger(item.quantity) &&
      (item.quantity ?? 0) > 0
    ) {
      const variantId = item.variant_id as number;
      quantities.set(
        variantId,
        (quantities.get(variantId) ?? 0) + (item.quantity as number),
      );
    }
  }

  return Array.from(quantities, ([variantId, quantity]) => ({
    variantId,
    quantity,
  }));
}

async function retrieveCheckoutSession(sessionId: string) {
  try {
    const stripe = createStripeClient();
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error("Failed to verify Checkout Session:", error);
    return null;
  }
}

async function CheckoutSuccessContent({
  searchParams,
}: CheckoutSuccessPageProps) {
  const { session_id: sessionId } = await searchParams;
  let paymentState: CheckoutPaymentState = "unverified";
  let orderNumber: string | null = null;
  let validatedOrderId: number | null = null;
  let validatedSessionId: string | null = null;
  let purchasedItems: CheckoutCartItem[] = [];

  if (isValidCheckoutSessionId(sessionId)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      notFound();
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        order_number,
        payment_status,
        stripe_checkout_session_id,
        order_items (
          variant_id,
          quantity
        )
        `,
      )
      .eq("user_id", user.id)
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    if (orderError) {
      console.error("Failed to verify checkout order:", orderError);
    } else if (orderData) {
      const order = orderData as CheckoutSuccessOrderRow;
      const session = await retrieveCheckoutSession(sessionId);

      if (session) {
        const stripeOrderId = parseCheckoutOrderId(
          session.metadata?.order_id ?? "",
        );
        const belongsToOrder =
          session.id === sessionId &&
          session.client_reference_id === user.id &&
          session.metadata?.user_id === user.id &&
          stripeOrderId === order.id;

        if (!belongsToOrder) {
          notFound();
        }
      }

      orderNumber = order.order_number;
      validatedOrderId = order.id;
      validatedSessionId = sessionId;
      purchasedItems = purchasedCartItems(order.order_items ?? []);
      paymentState = paymentStateFromOrderStatus(
        order.payment_status ?? "",
        checkoutOrderIsPaid(
          {
            paymentStatus: order.payment_status,
            checkoutSessionId: order.stripe_checkout_session_id,
          },
          sessionId,
        ),
      );
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center p-6">
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
        Checkout
      </p>
      <CheckoutSuccessStatus
        key={`${validatedSessionId ?? "unverified"}:${validatedOrderId ?? "none"}`}
        initialOrderNumber={orderNumber}
        initialPaymentState={paymentState}
        orderId={validatedOrderId}
        purchasedItems={purchasedItems}
        sessionId={validatedSessionId}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          className="rounded bg-foreground px-5 py-3 text-background"
          href="/account/orders"
        >
          View orders
        </Link>
        <Link className="rounded border px-5 py-3" href="/archive">
          Browse more posters
        </Link>
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessContent searchParams={searchParams} />
    </Suspense>
  );
}
