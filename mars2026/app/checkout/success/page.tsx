import Link from "next/link";
import { Suspense } from "react";

type CheckoutSuccessPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

async function CheckoutSuccessContent({
  searchParams,
}: CheckoutSuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center p-6">
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
        Checkout
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Thanks for your order.</h1>
      <p className="mt-4 text-muted-foreground">
        Stripe is confirming your payment. Your order will appear in your
        account once the payment webhook finishes processing.
      </p>

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
