import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

function formatCurrency(totalCents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(totalCents / 100);
}

async function OrdersList() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getClaims();
  const userId = userData?.claims?.sub;

  if (!userId) {
    return <p className="mt-6">Please sign in to view your orders.</p>;
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      fulfillment_status,
      payment_status,
      total_cents,
      currency,
      created_at,
      order_items (
        id,
        quantity,
        unit_price_cents,
        poster_title_snapshot,
        variant_label_snapshot
      )
      `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <pre className="mt-6 whitespace-pre-wrap text-sm text-red-600">
        {JSON.stringify(error, null, 2)}
      </pre>
    );
  }

  if (!orders?.length) {
    return <p className="mt-6">You do not have any orders yet.</p>;
  }

  return (
    <div className="mt-6 space-y-4">
      {orders.map((order) => (
        <section key={order.id} className="rounded border p-4">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="font-medium">
                Order {order.order_number ?? `#${order.id}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
            <p className="font-medium">
              {formatCurrency(order.total_cents, order.currency)}
            </p>
          </div>

          <div className="mt-4 grid gap-2 text-sm">
            <p>Fulfillment: {order.fulfillment_status}</p>
            <p>Payment: {order.payment_status}</p>
          </div>

          <div className="mt-4 space-y-2">
            {order.order_items?.map((item) => {
              return (
                <div key={item.id} className="rounded border p-3 text-sm">
                  <p className="font-medium">
                    {item.poster_title_snapshot ?? "Untitled poster"}
                  </p>
                  <p className="text-muted-foreground">
                    {item.variant_label_snapshot ?? "Unknown variant"} x{" "}
                    {item.quantity}
                  </p>
                  <p>
                    {formatCurrency(item.unit_price_cents, order.currency)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AccountOrdersPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-semibold">Your orders</h1>

      <Suspense fallback={<p className="mt-6">Loading orders...</p>}>
        <OrdersList />
      </Suspense>
    </main>
  );
}
