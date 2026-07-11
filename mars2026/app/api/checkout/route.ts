import { createStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { randomUUID } from "node:crypto";

const QUANTITY = 1;
const US_ONLY_SHIPPING: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection =
  {
    allowed_countries: ["US"],
  };

type PosterCheckoutRow = {
  id: number;
  title: string;
  slug: string;
  image_url: string | null;
  status: string;
};

type VariantCheckoutRow = {
  id: number;
  label: string | null;
  price_cents: number;
  currency: string;
  sku: string | null;
  stripe_price_id: string | null;
  posters: PosterCheckoutRow | PosterCheckoutRow[];
};

function firstRelation<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value;
}

function loginUrlFor(request: NextRequest, posterSlug?: string, variantId?: number) {
  const returnTo = posterSlug
    ? `/posters/${posterSlug}${variantId ? `?variant=${variantId}` : ""}`
    : "/shop";

  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("returnTo", returnTo);
  return loginUrl.pathname + loginUrl.search;
}

function checkoutLineItem(
  variant: VariantCheckoutRow,
  poster: PosterCheckoutRow,
): Stripe.Checkout.SessionCreateParams.LineItem {
  if (variant.stripe_price_id) {
    return {
      price: variant.stripe_price_id,
      quantity: QUANTITY,
    };
  }

  return {
    quantity: QUANTITY,
    price_data: {
      currency: variant.currency,
      unit_amount: variant.price_cents,
      product_data: {
        name: `${poster.title} - ${variant.label ?? "Poster"}`,
        images: poster.image_url ? [poster.image_url] : undefined,
        metadata: {
          poster_id: String(poster.id),
          variant_id: String(variant.id),
          variant_sku: variant.sku ?? "",
        },
      },
    },
  };
}

function createOrderNumber() {
  return `marsord-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

async function getOrCreateStripeCustomer({
  email,
  stripe,
  userId,
}: {
  email?: string;
  stripe: Stripe;
  userId: string;
}) {
  const adminSupabase = createAdminClient();

  const { data: existingProfile, error: existingProfileError } =
    await adminSupabase
      .from("customer_profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

  if (existingProfileError) {
    throw new Error(
      `Failed to load customer profile: ${existingProfileError.message}`,
    );
  }

  if (existingProfile?.stripe_customer_id) {
    return existingProfile.stripe_customer_id as string;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  const { error: upsertError } = await adminSupabase
    .from("customer_profiles")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customer.id,
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    throw new Error(`Failed to save customer profile: ${upsertError.message}`);
  }

  return customer.id;
}

async function upsertCheckoutProfile({
  email,
  stripeCustomerId,
  userId,
}: {
  email?: string;
  stripeCustomerId: string;
  userId: string;
}) {
  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.from("profiles").upsert(
    {
      user_id: userId,
      email,
      stripe_customer_id: stripeCustomerId,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to save checkout profile: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const stripe = createStripeClient();
    const body = (await request.json()) as { variantId?: unknown };
    const variantId = Number(body.variantId);

    if (!Number.isInteger(variantId) || variantId <= 0) {
      return NextResponse.json(
        { error: "Choose a valid poster size." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminSupabase = createAdminClient();
    const { data: variantData, error: variantError } = await adminSupabase
      .from("variants")
      .select(
        `
        id,
        label,
        price_cents,
        currency,
        sku,
        stripe_price_id,
        posters!inner (
          id,
          title,
          slug,
          image_url,
          status
        )
        `,
      )
      .eq("id", variantId)
      .eq("is_active", true)
      .eq("posters.status", "active")
      .maybeSingle();

    if (variantError) {
      throw new Error(`Failed to load poster variant: ${variantError.message}`);
    }

    if (!variantData) {
      return NextResponse.json(
        { error: "This poster size is not available right now." },
        { status: 404 },
      );
    }

    const variant = variantData as VariantCheckoutRow;
    const poster = firstRelation(variant.posters);

    if (!user) {
      return NextResponse.json(
        {
          error: "Please sign in before checkout.",
          loginUrl: loginUrlFor(request, poster.slug, variant.id),
        },
        { status: 401 },
      );
    }

    const stripeCustomerId = await getOrCreateStripeCustomer({
      email: user.email,
      stripe,
      userId: user.id,
    });
    await upsertCheckoutProfile({
      email: user.email,
      stripeCustomerId,
      userId: user.id,
    });

    const subtotalCents = variant.price_cents * QUANTITY;

    const { data: order, error: orderError } = await adminSupabase
      .from("orders")
      .insert({
        user_id: user.id,
        order_number: createOrderNumber(),
        stripe_customer_id: stripeCustomerId,
        payment_status: "pending",
        subtotal_cents: subtotalCents,
        shipping_cents: 0,
        tax_cents: 0,
        total_cents: subtotalCents,
        currency: variant.currency,
        customer_email: user.email,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      throw new Error(
        `Failed to create pending order: ${orderError?.message ?? "No order returned"}`,
      );
    }

    const { error: itemError } = await adminSupabase.from("order_items").insert({
      order_id: order.id,
      poster_id: poster.id,
      variant_id: variant.id,
      quantity: QUANTITY,
      unit_price_cents: variant.price_cents,
      line_total_cents: subtotalCents,
      poster_title_snapshot: poster.title,
      variant_label_snapshot: variant.label,
      poster_image_snapshot: poster.image_url,
    });

    if (itemError) {
      throw new Error(`Failed to create order item: ${itemError.message}`);
    }

    const shippingRateId = process.env.STRIPE_SHIPPING_RATE_ID;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      client_reference_id: user.id,
      line_items: [checkoutLineItem(variant, poster)],
      automatic_tax: {
        enabled: true,
      },
      customer_update: {
        shipping: "auto",
      },
      shipping_address_collection: US_ONLY_SHIPPING,
      shipping_options: shippingRateId
        ? [
            {
              shipping_rate: shippingRateId,
            },
          ]
        : undefined,
      metadata: {
        order_id: String(order.id),
        user_id: user.id,
        poster_id: String(poster.id),
        variant_id: String(variant.id),
      },
      payment_intent_data: {
        metadata: {
          order_id: String(order.id),
          user_id: user.id,
          poster_id: String(poster.id),
          variant_id: String(variant.id),
        },
      },
      success_url: `${request.nextUrl.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/posters/${poster.slug}?variant=${variant.id}`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    const { error: sessionUpdateError } = await adminSupabase
      .from("orders")
      .update({
        stripe_checkout_session_id: session.id,
      })
      .eq("id", order.id);

    if (sessionUpdateError) {
      throw new Error(
        `Failed to save checkout session: ${sessionUpdateError.message}`,
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Checkout could not be started. Please try again." },
      { status: 500 },
    );
  }
}
