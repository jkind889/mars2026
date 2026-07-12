import { createStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

function getOrderId(session: Stripe.Checkout.Session) {
  const orderId = Number(session.metadata?.order_id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error("Checkout Session is missing a valid order_id.");
  }

  return orderId;
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id ?? null;
}

function sessionOrderFields(session: Stripe.Checkout.Session) {
  const shippingDetails = session.collected_information?.shipping_details;
  const address = shippingDetails?.address;

  return {
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: getPaymentIntentId(session),
    subtotal_cents: session.amount_subtotal ?? 0,
    shipping_cents: session.total_details?.amount_shipping ?? 0,
    tax_cents: session.total_details?.amount_tax ?? 0,
    total_cents: session.amount_total ?? 0,
    currency: session.currency,
    customer_email:
      session.customer_details?.email ?? session.customer_email ?? null,
    shipping_name: shippingDetails?.name ?? null,
    shipping_address_line1: address?.line1 ?? null,
    shipping_address_line2: address?.line2 ?? null,
    shipping_city: address?.city ?? null,
    shipping_state: address?.state ?? null,
    shipping_postal_code: address?.postal_code ?? null,
    shipping_country: address?.country ?? null,
  };
}

async function handleSuccessfulCheckout(
  session: Stripe.Checkout.Session,
  isAsyncSuccess: boolean,
) {
  if (!isAsyncSuccess && session.payment_status !== "paid") {
    console.info(
      `Checkout Session ${session.id} completed without a paid status.`,
    );
    return;
  }

  const orderId = getOrderId(session);
  const supabase = createAdminClient();

  const { data: updatedOrder, error } = await supabase
    .from("orders")
    .update({
      ...sessionOrderFields(session),
      payment_status: "paid",
      fulfillment_status: "unfulfilled",
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark order ${orderId} as paid: ${error.message}`);
  }

  if (!updatedOrder) {
    console.info(
      `Order ${orderId} was already processed or is not pending; skipping duplicate payment update.`,
    );
  }
}

async function handleFailedCheckout(session: Stripe.Checkout.Session) {
  const orderId = getOrderId(session);
  const supabase = createAdminClient();

  const { data: updatedOrder, error } = await supabase
    .from("orders")
    .update({
      stripe_checkout_session_id: session.id,
      payment_status: "failed",
      fulfillment_status: "canceled",
    })
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark order ${orderId} as failed: ${error.message}`);
  }

  if (!updatedOrder) {
    console.info(
      `Order ${orderId} was already processed or is not pending; skipping failed-payment update.`,
    );
  }
}

async function handleExpiredCheckout(session: Stripe.Checkout.Session) {
  const orderId = getOrderId(session);
  const supabase = createAdminClient();

  const { data: updatedOrder, error } = await supabase
    .from("orders")
    .update({
      stripe_checkout_session_id: session.id,
      payment_status: "canceled",
      fulfillment_status: "canceled",
    })
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to mark order ${orderId} as canceled: ${error.message}`,
    );
  }

  if (!updatedOrder) {
    console.info(
      `Order ${orderId} was already processed or is not pending; skipping expired-session update.`,
    );
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe webhook configuration." },
      { status: 400 },
    );
  }

  const payload = await request.text();
  const stripe = createStripeClient();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("Invalid Stripe webhook signature:", error);

    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleSuccessfulCheckout(
          event.data.object as Stripe.Checkout.Session,
          false,
        );
        break;

      case "checkout.session.async_payment_succeeded":
        await handleSuccessfulCheckout(
          event.data.object as Stripe.Checkout.Session,
          true,
        );
        break;

      case "checkout.session.async_payment_failed":
        await handleFailedCheckout(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "checkout.session.expired":
        await handleExpiredCheckout(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
