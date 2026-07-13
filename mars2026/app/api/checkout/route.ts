import { randomUUID } from "node:crypto";
import { createStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

const MAX_CART_LINES = 50;
const MAX_QUANTITY = 99;
const US_ONLY_SHIPPING: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection =
  {
    allowed_countries: ["US"],
  };

type CartItem = {
  variantId: number;
  quantity: number;
};

type PosterCheckoutRow = {
  id: number;
  title: string;
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

type ValidatedCartItem = CartItem & {
  lineTotalCents: number;
  poster: PosterCheckoutRow;
  variant: VariantCheckoutRow;
};

function firstRelation<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value;
}

function loginUrlFor(request: NextRequest) {
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("returnTo", "/cart");
  return loginUrl.pathname + loginUrl.search;
}

function normalizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error("Your cart is empty.");
  }

  const quantities = new Map<number, number>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error("Your cart contains an invalid item.");
    }

    const candidate = item as {
      variantId?: unknown;
      quantity?: unknown;
    };

    if (
      typeof candidate.variantId !== "number" ||
      !Number.isInteger(candidate.variantId) ||
      candidate.variantId <= 0 ||
      typeof candidate.quantity !== "number" ||
      !Number.isInteger(candidate.quantity) ||
      candidate.quantity <= 0
    ) {
      throw new Error("Your cart contains an invalid item or quantity.");
    }

    const quantity =
      (quantities.get(candidate.variantId) ?? 0) + candidate.quantity;

    if (quantity > MAX_QUANTITY) {
      throw new Error(
        `You can purchase at most ${MAX_QUANTITY} of one poster size.`,
      );
    }

    quantities.set(candidate.variantId, quantity);
  }

  if (quantities.size > MAX_CART_LINES) {
    throw new Error(`Your cart can contain at most ${MAX_CART_LINES} items.`);
  }

  return Array.from(quantities, ([variantId, quantity]) => ({
    variantId,
    quantity,
  }));
}

function checkoutLineItem(
  variant: VariantCheckoutRow,
  poster: PosterCheckoutRow,
  quantity: number,
): Stripe.Checkout.SessionCreateParams.LineItem {
  if (variant.stripe_price_id) {
    return {
      price: variant.stripe_price_id,
      quantity,
    };
  }

  return {
    quantity,
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

async function deletePendingOrder(orderId: number) {
  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("payment_status", "pending");

  if (error) {
    console.error(`Failed to clean up pending order ${orderId}:`, error);
  }
}

async function expireSessionAndDeleteOrder({
  orderId,
  sessionId,
  stripe,
}: {
  orderId: number;
  sessionId: string;
  stripe: Stripe;
}) {
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (error) {
    console.error(
      `Failed to expire Checkout Session ${sessionId}; keeping pending order ${orderId}:`,
      error,
    );
    throw new Error("Failed to safely clean up the Checkout Session.");
  }

  await deletePendingOrder(orderId);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Please sign in before checkout.",
          loginUrl: loginUrlFor(request),
        },
        { status: 401 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Checkout received an invalid request." },
        { status: 400 },
      );
    }

    let cartItems: CartItem[];

    try {
      cartItems = normalizeCartItems(
        body && typeof body === "object"
          ? (body as { items?: unknown }).items
          : undefined,
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Invalid cart.",
        },
        { status: 400 },
      );
    }

    const adminSupabase = createAdminClient();
    const variantIds = cartItems.map((item) => item.variantId);
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
          image_url,
          status
        )
        `,
      )
      .in("id", variantIds)
      .eq("is_active", true)
      .eq("posters.status", "active");

    if (variantError) {
      throw new Error(`Failed to load poster variants: ${variantError.message}`);
    }

    const variants = (variantData ?? []) as VariantCheckoutRow[];
    const variantsById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );

    if (variantsById.size !== cartItems.length) {
      return NextResponse.json(
        {
          error:
            "One or more cart items are no longer available. Refresh your cart and try again.",
        },
        { status: 409 },
      );
    }

    const validatedItems: ValidatedCartItem[] = cartItems.map((item) => {
      const variant = variantsById.get(item.variantId);

      if (!variant) {
        throw new Error(`Variant ${item.variantId} could not be loaded.`);
      }

      const poster = firstRelation(variant.posters);

      return {
        ...item,
        variant,
        poster,
        lineTotalCents: variant.price_cents * item.quantity,
      };
    });

    const currencies = new Set(
      validatedItems.map((item) => item.variant.currency.toLowerCase()),
    );

    if (currencies.size !== 1) {
      return NextResponse.json(
        { error: "All items in a cart must use the same currency." },
        { status: 400 },
      );
    }

    const currency = validatedItems[0].variant.currency;
    const subtotalCents = validatedItems.reduce(
      (total, item) => total + item.lineTotalCents,
      0,
    );
    const stripe = createStripeClient();
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
        currency,
        customer_email: user.email,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      throw new Error(
        `Failed to create pending order: ${orderError?.message ?? "No order returned"}`,
      );
    }

    const { error: itemError } = await adminSupabase
      .from("order_items")
      .insert(
        validatedItems.map((item) => ({
          order_id: order.id,
          poster_id: item.poster.id,
          variant_id: item.variant.id,
          quantity: item.quantity,
          unit_price_cents: item.variant.price_cents,
          line_total_cents: item.lineTotalCents,
          poster_title_snapshot: item.poster.title,
          variant_label_snapshot: item.variant.label,
          poster_image_snapshot: item.poster.image_url,
        })),
      );

    if (itemError) {
      await deletePendingOrder(order.id);
      throw new Error(`Failed to create order items: ${itemError.message}`);
    }

    const shippingRateId = process.env.STRIPE_SHIPPING_RATE_ID;
    let session: Stripe.Checkout.Session;

    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: stripeCustomerId,
        client_reference_id: user.id,
        line_items: validatedItems.map((item) =>
          checkoutLineItem(item.variant, item.poster, item.quantity),
        ),
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
        },
        payment_intent_data: {
          metadata: {
            order_id: String(order.id),
            user_id: user.id,
          },
        },
        success_url: `${request.nextUrl.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${request.nextUrl.origin}/cart`,
      });
    } catch (error) {
      await deletePendingOrder(order.id);
      throw error;
    }

    if (!session.url) {
      await expireSessionAndDeleteOrder({
        orderId: order.id,
        sessionId: session.id,
        stripe,
      });
      throw new Error("Stripe did not return a checkout URL.");
    }

    const { error: sessionUpdateError } = await adminSupabase
      .from("orders")
      .update({
        stripe_checkout_session_id: session.id,
      })
      .eq("id", order.id);

    if (sessionUpdateError) {
      await expireSessionAndDeleteOrder({
        orderId: order.id,
        sessionId: session.id,
        stripe,
      });
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
