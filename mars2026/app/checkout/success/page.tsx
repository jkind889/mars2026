import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckoutSuccessCartCleanup } from "@/components/checkout-success-cart-cleanup";
import { createStripeClient } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

type CheckoutSuccessPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

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
  let paymentState: "paid" | "processing" | "unverified" = "unverified";
  let orderNumber: string | null = null;

  if (sessionId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      notFound();
    }

    const session = await retrieveCheckoutSession(sessionId);

    if (session) {
      const belongsToUser =
        session.client_reference_id === user.id &&
        session.metadata?.user_id === user.id;

      if (!belongsToUser) {
        notFound();
      }

      paymentState = "processing";

      const orderId = Number(session.metadata?.order_id);

      if (Number.isInteger(orderId) && orderId > 0) {
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("order_number, payment_status, stripe_checkout_session_id")
          .eq("id", orderId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (orderError) {
          console.error("Failed to verify paid order:", orderError);
        } else if (order) {
          orderNumber = order.order_number;

          if (
            session.payment_status === "paid" &&
            order.payment_status === "paid" &&
            order.stripe_checkout_session_id === session.id
          ) {
            paymentState = "paid";
          }
        }
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center p-6">
      <CheckoutSuccessCartCleanup shouldClear={paymentState === "paid"} />

      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
        Checkout
      </p>
      <h1 className="mt-3 text-3xl font-semibold">
        {paymentState === "paid"
          ? "Thanks for your order."
          : "Your payment is processing."}
      </h1>
      {paymentState === "paid" ? (
        <p className="mt-4 text-muted-foreground">
          Your payment and order are confirmed. Your cart has been cleared.
        </p>
      ) : paymentState === "processing" ? (
        <p className="mt-4 text-muted-foreground">
          We are waiting for the secure payment notification to update your
          order. Your cart will remain available until it is confirmed.
        </p>
      ) : (
        <p className="mt-4 text-muted-foreground">
          We could not verify this Checkout Session. Your cart has not been
          cleared.
        </p>
      )}

      {orderNumber ? (
        <p className="mt-4 rounded border p-3 text-sm text-muted-foreground">
          Order: {orderNumber}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          className="rounded bg-foreground px-5 py-3 text-background"
          href="/account/orders"
        >
          View orders
        </Link>
        <Link className="rounded border px-5 py-3" href="/shop">
          Back to shop
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
