import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

function formatCurrency(totalCents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(totalCents / 100);
}

function formatAddress(order: {
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
}) {
  const lines = [
    order.shipping_address_line1,
    order.shipping_address_line2,
    [order.shipping_city, order.shipping_state, order.shipping_postal_code]
      .filter(Boolean)
      .join(", "),
    order.shipping_country,
  ].filter(Boolean);

  return lines.length ? lines.join("\n") : "No shipping address";
}

async function AdminOrdersList() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getClaims();
  const userId = userData?.claims?.sub;

  if (!userId) {
    notFound();
  }

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (adminError || !adminUser) {
    notFound();
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
      shipping_name,
      shipping_address_line1,
      shipping_address_line2,
      shipping_city,
      shipping_state,
      shipping_postal_code,
      shipping_country,
      tracking_number,
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
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <pre className="mt-6 whitespace-pre-wrap text-sm text-red-600">
        {JSON.stringify(error, null, 2)}
      </pre>
    );
  }

  if (!orders?.length) {
    return <p className="mt-6">There are no orders yet.</p>;
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
                {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
            <p className="font-medium">
              {formatCurrency(order.total_cents, order.currency)}
            </p>
          </div>

          <div className="mt-4 grid gap-2 text-sm">
            <p>Fulfillment: {order.fulfillment_status}</p>
            <p>Payment: {order.payment_status}</p>
            <p>Ship to: {order.shipping_name ?? "No name provided"}</p>
            <p>Tracking: {order.tracking_number ?? "Not added yet"}</p>
            <pre className="whitespace-pre-wrap rounded bg-muted p-3">
              {formatAddress(order)}
            </pre>
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

export default function AdminOrdersPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-semibold">Admin orders</h1>

      <Suspense fallback={<p className="mt-6">Loading orders...</p>}>
        <AdminOrdersList />
      </Suspense>
    </main>
  );
}
