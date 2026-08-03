"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCart, type CartItem } from "@/components/cart-provider";
import { createClient } from "@/lib/supabase/client";

type PosterRelation = {
  title: string;
  slug: string;
  image_url: string | null;
  status: string;
};

type VariantRow = {
  id: number;
  label: string | null;
  price_cents: number;
  currency: string;
  posters: PosterRelation | PosterRelation[];
};

function firstRelation<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatCurrency(totalCents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(totalCents / 100);
}

function variantIds(items: CartItem[]) {
  return items.map((item) => item.variantId);
}

export default function CartPage() {
  const {
    items: cartItems,
    isHydrated,
    updateQuantity,
    removeItem,
  } = useCart();
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const checkoutAttemptIdRef = useRef<string | null>(null);

  useEffect(() => {
    checkoutAttemptIdRef.current = null;
  }, [cartItems]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let isCurrent = true;
    const ids = variantIds(cartItems);

    if (!ids.length) {
      setVariants([]);
      setError(null);
      setIsLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsLoading(true);
    setError(null);

    const loadVariants = async () => {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("variants")
        .select(
          `
          id,
          label,
          price_cents,
          currency,
          posters!inner (
            title,
            slug,
            image_url,
            status
          )
          `,
        )
        .in("id", ids)
        .eq("is_active", true)
        .eq("posters.status", "active");

      if (!isCurrent) {
        return;
      }

      if (queryError) {
        setError("We could not load the latest cart details.");
        setVariants([]);
      } else {
        setVariants((data ?? []) as VariantRow[]);
      }

      setIsLoading(false);
    };

    void loadVariants();

    return () => {
      isCurrent = false;
    };
  }, [cartItems, isHydrated]);

  const variantsById = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  );

  const displayItems = useMemo(
    () =>
      cartItems.map((item) => ({
        ...item,
        variant: variantsById.get(item.variantId),
      })),
    [cartItems, variantsById],
  );

  const subtotal = displayItems.reduce((total, item) => {
    return total + (item.variant?.price_cents ?? 0) * item.quantity;
  }, 0);

  const unavailableCount = displayItems.filter(
    (item) => !item.variant,
  ).length;

  const canCheckout =
    isHydrated &&
    !isLoading &&
    !error &&
    cartItems.length > 0 &&
    unavailableCount === 0;

  const handleCheckout = async () => {
    if (!canCheckout || isCheckingOut) {
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError(null);

    const checkoutAttemptId =
      checkoutAttemptIdRef.current ?? crypto.randomUUID();
    checkoutAttemptIdRef.current = checkoutAttemptId;

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkoutAttemptId,
          items: cartItems.map(({ variantId, quantity }) => ({
            variantId,
            quantity,
          })),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        loginUrl?: string;
        resetCheckoutAttempt?: boolean;
        url?: string;
      };

      if (payload.resetCheckoutAttempt) {
        checkoutAttemptIdRef.current = null;
      }

      if (response.status === 401 && payload.loginUrl) {
        window.location.assign(payload.loginUrl);
        return;
      }

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Checkout could not be started.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Checkout could not be started.",
      );
      setIsCheckingOut(false);
    }
  };

  if (!isHydrated || isLoading) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Cart
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Your cart</h1>
        <p className="mt-8 text-muted-foreground">Loading your cart...</p>
      </main>
    );
  }

  if (!cartItems.length) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Cart
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Your cart</h1>
        <p className="mt-8 text-muted-foreground">
          Your cart is empty. Find a poster to get started.
        </p>
        <Button asChild className="mt-6">
          <Link href="/archive">Browse posters</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Cart
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Your cart</h1>
        </div>
        <Link className="text-sm underline underline-offset-4" href="/archive">
          Continue browsing
        </Link>
      </div>

      {error ? (
        <p className="mt-6 rounded border border-red-200 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          {displayItems.map((item) => {
            const poster = item.variant
              ? firstRelation(item.variant.posters)
              : null;

            if (!item.variant || !poster) {
              return (
                <article
                  key={item.variantId}
                  className="flex flex-wrap items-center justify-between gap-4 rounded border border-dashed p-4"
                >
                  <div>
                    <p className="font-medium">Item unavailable</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This poster or size is no longer available.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeItem(item.variantId)}
                  >
                    Remove
                  </Button>
                </article>
              );
            }

            return (
              <article
                key={item.variantId}
                className="grid gap-4 rounded border p-4 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  {poster.image_url ? (
                    <img
                      className="h-full w-full object-cover"
                      src={poster.image_url}
                      alt={poster.title}
                    />
                  ) : null}
                </div>

                <div>
                  <h2 className="font-medium">
                    <Link
                      className="underline underline-offset-4"
                      href={`/posters/${poster.slug}`}
                    >
                      {poster.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.variant.label ?? "Poster"}
                  </p>
                  <p className="mt-3 font-medium">
                    {formatCurrency(
                      item.variant.price_cents,
                      item.variant.currency,
                    )}
                  </p>
                  <button
                    type="button"
                    className="mt-3 text-sm text-muted-foreground underline underline-offset-4"
                    onClick={() => removeItem(item.variantId)}
                  >
                    Remove
                  </button>
                </div>

                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Decrease quantity of ${poster.title}`}
                      onClick={() =>
                        updateQuantity(item.variantId, item.quantity - 1)
                      }
                    >
                      −
                    </Button>
                    <span className="min-w-6 text-center text-sm">
                      {item.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Increase quantity of ${poster.title}`}
                      onClick={() =>
                        updateQuantity(item.variantId, item.quantity + 1)
                      }
                    >
                      +
                    </Button>
                  </div>
                  <p className="text-sm font-medium">
                    {formatCurrency(
                      item.variant.price_cents * item.quantity,
                      item.variant.currency,
                    )}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="h-fit rounded border p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>

          {unavailableCount ? (
            <p className="mt-4 text-sm text-amber-700">
              Remove unavailable items before checkout.
            </p>
          ) : null}

          {checkoutError ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {checkoutError}
            </p>
          ) : null}

          <Button
            type="button"
            className="mt-6 w-full"
            disabled={!canCheckout || isCheckingOut}
            onClick={handleCheckout}
          >
            {isCheckingOut ? "Redirecting..." : "Checkout"}
          </Button>
        </aside>
      </div>
    </main>
  );
}
