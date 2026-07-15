"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
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
  const [addedVariantId, setAddedVariantId] = useState<number | null>(null);
  const { addItem } = useCart();

  const selectedVariant = variants.find(
    (variant) => variant.id === selectedVariantId,
  );

  const handleAddToCart = () => {
    if (!selectedVariantId) {
      return;
    }

    addItem(selectedVariantId);
    setAddedVariantId(selectedVariantId);
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
              onClick={() => {
                setSelectedVariantId(variant.id);
                setAddedVariantId(null);
              }}
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
        disabled={!selectedVariant}
        onClick={handleAddToCart}
      >
        {addedVariantId === selectedVariantId ? "Added to cart" : "Add to cart"}
      </Button>

      {addedVariantId === selectedVariantId ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          Added. <Link className="underline underline-offset-4" href="/cart">View cart</Link>
        </p>
      ) : null}
    </section>
  );
}
