import { createStripeClient } from "@/lib/stripe";
import {
  CheckoutPublicError,
  createOrderNumber,
  isIndeterminateStripeError,
  isStripeResourceMissing,
  normalizeCartItems,
  normalizeCheckoutAttemptId,
  stripePriceMatchesVariant,
  type CartItem,
} from "@/lib/checkout-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

const US_ONLY_SHIPPING: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection =
  {
    allowed_countries: ["US"],
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

type CheckoutOrderRow = {
  id: number;
  payment_status: string;
  stripe_checkout_session_id: string | null;
};

type CheckoutOrderItemRow = {
  variant_id: number | null;
  quantity: number | null;
  unit_price_cents: number | null;
};

function firstRelation<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value;
}

function loginUrlFor(request: NextRequest) {
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("returnTo", "/cart");
  return loginUrl.pathname + loginUrl.search;
}

function checkoutOrigin(request: NextRequest) {
  const configuredUrl = process.env.SITE_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const candidate = configuredUrl
    ? configuredUrl
    : vercelUrl
      ? `https://${vercelUrl}`
      : request.nextUrl.origin;
  const url = new URL(candidate);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SITE_URL must use http or https.");
  }

  return url.origin;
}

function configuredShippingRateId() {
  const shippingRateId = process.env.STRIPE_SHIPPING_RATE_ID?.trim();

  if (!shippingRateId) {
    throw new CheckoutPublicError(
      "Shipping is not configured, so checkout is temporarily unavailable.",
      503,
      true,
    );
  }

  return shippingRateId;
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

function stripeCustomerIsDeleted(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): customer is Stripe.DeletedCustomer {
  return "deleted" in customer && customer.deleted === true;
}

async function validateStripePrices(
  items: ValidatedCartItem[],
  stripe: Stripe,
) {
  await Promise.all(
    items.map(async ({ variant }) => {
      if (!variant.stripe_price_id) {
        return;
      }

      let price: Stripe.Price;

      try {
        price = await stripe.prices.retrieve(variant.stripe_price_id);
      } catch (error) {
        if (isStripeResourceMissing(error)) {
          throw new CheckoutPublicError(
            "One of the poster prices is no longer available. Please contact the shop before checking out.",
            409,
            true,
          );
        }

        throw error;
      }

      const matchesDatabase = stripePriceMatchesVariant(price, variant);

      if (!matchesDatabase) {
        throw new CheckoutPublicError(
          "One of the poster prices changed. Refresh the shop before checking out.",
          409,
          true,
        );
      }
    }),
  );
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
    const existingCustomerId = existingProfile.stripe_customer_id as string;

    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);

      if (!stripeCustomerIsDeleted(customer)) {
        return existingCustomerId;
      }
    } catch (error) {
      if (!isStripeResourceMissing(error)) {
        throw error;
      }
    }
  }

  const customerIdempotencySuffix =
    existingProfile?.stripe_customer_id ?? "initial";
  const customer = await stripe.customers.create(
    {
      email,
      metadata: {
        supabase_user_id: userId,
      },
    },
    {
      idempotencyKey: `customer-${userId}-${customerIdempotencySuffix}`,
    },
  );

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
    return false;
  }

  return true;
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

  const deleted = await deletePendingOrder(orderId);

  if (!deleted) {
    throw new Error("Failed to safely clean up the pending order.");
  }
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
    let checkoutAttemptId: string;

    try {
      const candidate =
        body && typeof body === "object"
          ? (body as { checkoutAttemptId?: unknown; items?: unknown })
          : undefined;
      cartItems = normalizeCartItems(candidate?.items);
      checkoutAttemptId = normalizeCheckoutAttemptId(
        candidate?.checkoutAttemptId,
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Invalid cart.",
          resetCheckoutAttempt:
            error instanceof CheckoutPublicError
              ? error.resetCheckoutAttempt
              : false,
        },
        {
          status:
            error instanceof CheckoutPublicError ? error.status : 400,
        },
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
    const shippingRateId = configuredShippingRateId();

    await validateStripePrices(validatedItems, stripe);

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

    const orderNumber = createOrderNumber(checkoutAttemptId);
    const { data: insertedOrder, error: orderError } = await adminSupabase
      .from("orders")
      .insert({
        user_id: user.id,
        order_number: orderNumber,
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
      .maybeSingle();

    let order: CheckoutOrderRow;
    let reusedOrder = false;

    if (orderError?.code === "23505") {
      const { data: existingOrder, error: existingOrderError } =
        await adminSupabase
          .from("orders")
          .select("id, payment_status, stripe_checkout_session_id")
          .eq("order_number", orderNumber)
          .eq("user_id", user.id)
          .maybeSingle();

      if (existingOrderError || !existingOrder) {
        throw new Error(
          `Failed to recover checkout attempt: ${existingOrderError?.message ?? "No order returned"}`,
        );
      }

      order = existingOrder as CheckoutOrderRow;
      reusedOrder = true;
    } else if (orderError || !insertedOrder) {
      throw new Error(
        `Failed to create pending order: ${orderError?.message ?? "No order returned"}`,
      );
    } else {
      order = {
        id: insertedOrder.id,
        payment_status: "pending",
        stripe_checkout_session_id: null,
      };
    }

    const successUrl = `${checkoutOrigin(request)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;

    if (order.payment_status === "paid" && order.stripe_checkout_session_id) {
      return NextResponse.json({
        url: successUrl.replace(
          "{CHECKOUT_SESSION_ID}",
          order.stripe_checkout_session_id,
        ),
      });
    }

    if (order.payment_status !== "pending") {
      throw new CheckoutPublicError(
        "This checkout attempt is no longer active. Please try checkout again.",
        409,
        true,
      );
    }

    if (reusedOrder) {
      const { data: existingItems, error: existingItemsError } =
        await adminSupabase
          .from("order_items")
          .select("variant_id, quantity, unit_price_cents")
          .eq("order_id", order.id);

      if (existingItemsError) {
        throw new Error(
          `Failed to recover order items: ${existingItemsError.message}`,
        );
      }

      const existingItemsByVariant = new Map(
        ((existingItems ?? []) as CheckoutOrderItemRow[]).map((item) => [
          item.variant_id,
          item,
        ]),
      );
      const itemsMatch =
        existingItemsByVariant.size === validatedItems.length &&
        validatedItems.every((item) => {
          const existingItem = existingItemsByVariant.get(item.variant.id);
          return (
            existingItem?.quantity === item.quantity &&
            existingItem.unit_price_cents === item.variant.price_cents
          );
        });

      if (!itemsMatch) {
        throw new CheckoutPublicError(
          existingItemsByVariant.size
            ? "Your cart changed during checkout. Please try checkout again."
            : "Checkout is already starting. Please wait a moment and try again.",
          409,
          existingItemsByVariant.size > 0,
        );
      }
    } else {
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
    }

    if (order.stripe_checkout_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          order.stripe_checkout_session_id,
        );

        if (existingSession.status === "open" && existingSession.url) {
          return NextResponse.json({ url: existingSession.url });
        }

        if (existingSession.status === "complete") {
          return NextResponse.json({
            url: successUrl.replace(
              "{CHECKOUT_SESSION_ID}",
              existingSession.id,
            ),
          });
        }
      } catch (error) {
        if (!isStripeResourceMissing(error)) {
          throw error;
        }
      }

      throw new CheckoutPublicError(
        "This Checkout Session is no longer available. Please try checkout again.",
        409,
        true,
      );
    }

    let session: Stripe.Checkout.Session;

    try {
      session = await stripe.checkout.sessions.create(
        {
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
          shipping_options: [
            {
              shipping_rate: shippingRateId,
            },
          ],
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
          success_url: successUrl,
          cancel_url: `${checkoutOrigin(request)}/cart`,
        },
        {
          idempotencyKey: `checkout-session-${checkoutAttemptId}`,
        },
      );
    } catch (error) {
      if (isIndeterminateStripeError(error)) {
        console.error(
          `Stripe returned an indeterminate result for order ${order.id}; keeping the pending order for retry or webhook reconciliation.`,
          error,
        );
        throw new CheckoutPublicError(
          "Stripe did not confirm whether checkout started. Please try again; your checkout attempt will be safely resumed.",
          503,
        );
      }

      await deletePendingOrder(order.id);
      throw new CheckoutPublicError(
        "Stripe could not start checkout. Please try again.",
        502,
        true,
      );
    }

    if (!session.url) {
      await expireSessionAndDeleteOrder({
        orderId: order.id,
        sessionId: session.id,
        stripe,
      });
      throw new CheckoutPublicError(
        "Stripe did not return a checkout URL. Please try again.",
        502,
        true,
      );
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
      throw new CheckoutPublicError(
        "Checkout could not be saved safely. Please try again.",
        500,
        true,
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error(error);

    if (error instanceof CheckoutPublicError) {
      return NextResponse.json(
        {
          error: error.message,
          resetCheckoutAttempt: error.resetCheckoutAttempt,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Checkout could not be started. Please try again." },
      { status: 500 },
    );
  }
}
