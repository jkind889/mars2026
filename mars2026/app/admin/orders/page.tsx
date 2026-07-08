import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

function formatCurrency(totalCents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(totalCents / 100);
}

function formatAddress(address: unknown) {
  if (!address) {
    return "No shipping address";
  }

  if (typeof address === "string") {
    return address;
  }

  return JSON.stringify(address, null, 2);
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
      fulfillment_status,
      payment_status,
      total_cents,
      currency,
      shipping_name,
      shipping_address,
      tracking_number,
      created_at,
      order_items (
        id,
        quantity,
        unit_price_cents,
        posters (
          id,
          title
        ),
        variants (
          id,
          label
        )
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
              <p className="font-medium">Order #{order.id}</p>
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
              {formatAddress(order.shipping_address)}
            </pre>
          </div>

          <div className="mt-4 space-y-2">
            {order.order_items?.map((item) => {
              const poster = firstRelation(item.posters);
              const variant = firstRelation(item.variants);

              return (
                <div key={item.id} className="rounded border p-3 text-sm">
                  <p className="font-medium">
                    {poster?.title ?? "Untitled poster"}
                  </p>
                  <p className="text-muted-foreground">
                    {variant?.label ?? "Unknown variant"} x {item.quantity}
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
