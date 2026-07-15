import { NextResponse, type NextRequest } from "next/server";

import {
  checkoutOrderIsPaid,
  isValidCheckoutSessionId,
  parseCheckoutOrderId,
} from "@/lib/checkout-success";
import { createClient } from "@/lib/supabase/server";

type OrderStatusRouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);

  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Vary", "Cookie");

  return NextResponse.json(body, { ...init, headers });
}

export async function GET(
  request: NextRequest,
  { params }: OrderStatusRouteContext,
) {
  const { orderId: orderIdParam } = await params;
  const orderId = parseCheckoutOrderId(orderIdParam);
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!orderId || !isValidCheckoutSessionId(sessionId)) {
    return noStoreJson(
      { error: "A valid order and Checkout Session are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("order_number, payment_status, stripe_checkout_session_id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (orderError) {
    console.error(`Failed to load checkout status for order ${orderId}.`);

    return noStoreJson(
      { error: "Order status is temporarily unavailable." },
      { status: 500 },
    );
  }

  if (!order) {
    return noStoreJson({ error: "Order not found." }, { status: 404 });
  }

  const isPaid = checkoutOrderIsPaid(
    {
      paymentStatus: order.payment_status,
      checkoutSessionId: order.stripe_checkout_session_id,
    },
    sessionId,
  );

  return noStoreJson({
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    isPaid,
  });
}
