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

      paymentState =
        session.payment_status === "paid" ? "paid" : "processing";
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
          Stripe confirmed your payment. Your cart has been cleared, and the
          webhook is updating your order history.
        </p>
      ) : paymentState === "processing" ? (
        <p className="mt-4 text-muted-foreground">
          Stripe has not confirmed payment yet. Your cart will remain available
          while the payment finishes processing.
        </p>
      ) : (
        <p className="mt-4 text-muted-foreground">
          We could not verify this Checkout Session. Your cart has not been
          cleared.
        </p>
      )}

      {sessionId ? (
        <p className="mt-4 rounded border p-3 text-sm text-muted-foreground">
          Session: {sessionId}
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
