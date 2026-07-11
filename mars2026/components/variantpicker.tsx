"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

type Variant = {
  id: number;
  label: string;
  price_cents: number;
};

type VariantPickerProps = {
  variants: Variant[];
  initialVariantId?: number;
};

export function VariantPicker({
  variants,
  initialVariantId,
}: VariantPickerProps) {
  const initialVariant = variants.some(
    (variant) => variant.id === initialVariantId,
  )
    ? initialVariantId
    : variants[0]?.id;
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    initialVariant ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const selectedVariant = variants.find(
    (variant) => variant.id === selectedVariantId,
  );

  const handleCheckout = async () => {
    if (!selectedVariantId) {
      return;
    }

    setIsCheckingOut(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ variantId: selectedVariantId }),
      });

      const payload = (await response.json()) as {
        error?: string;
        loginUrl?: string;
        url?: string;
      };

      if (response.status === 401 && payload.loginUrl) {
        window.location.assign(payload.loginUrl);
        return;
      }

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Checkout could not be started.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Checkout failed.");
      setIsCheckingOut(false);
    }
  };

  if (!variants.length) {
    return <p className="mt-6">This poster is not available right now.</p>;
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium">Choose a size</h2>

      <div className="mt-3 flex flex-wrap gap-3">
        {variants.map((variant) => {
          const isSelected = variant.id === selectedVariantId;

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => setSelectedVariantId(variant.id)}
              className={
                isSelected
                  ? "rounded border border-foreground px-4 py-2"
                  : "rounded border px-4 py-2"
              }
            >
              {variant.label}
            </button>
          );
        })}
      </div>

      {selectedVariant ? (
        <p className="mt-4">
          ${(selectedVariant.price_cents / 100).toFixed(2)}
        </p>
      ) : null}

      <Button
        type="button"
        className="mt-6"
        disabled={!selectedVariant || isCheckingOut}
        onClick={handleCheckout}
      >
        {isCheckingOut ? "Redirecting..." : "Buy"}
      </Button>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
