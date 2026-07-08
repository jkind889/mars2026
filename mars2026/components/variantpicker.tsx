"use client";

import { useState } from "react";

type Variant = {
  id: number;
  label: string;
  price_cents: number;
};

type VariantPickerProps = {
  variants: Variant[];
};

export function VariantPicker({ variants }: VariantPickerProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    variants[0]?.id ?? null,
  );

  const selectedVariant = variants.find(
    (variant) => variant.id === selectedVariantId,
  );

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

      <button
        type="button"
        className="mt-6 rounded bg-foreground px-5 py-3 text-background"
      >
        Buy
      </button>
    </section>
  );
}
