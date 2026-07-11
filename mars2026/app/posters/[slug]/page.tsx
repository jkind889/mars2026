import { createClient } from "@/lib/supabase/server";
import { VariantPicker } from "@/components/variantpicker";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type PosterPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    variant?: string;
  }>;
};

async function PosterDetails({ params, searchParams }: PosterPageProps) {
  const { slug } = await params;
  const { variant } = await searchParams;
  const initialVariantId = variant ? Number(variant) : undefined;
  const supabase = await createClient();

  const { data: poster, error: posterError } = await supabase
    .from("posters")
    .select("id, title, slug, image_url, description")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (posterError || !poster) {
    notFound();
  }

  const { data: variants, error: variantsError } = await supabase
    .from("variants")
    .select("id, label, price_cents")
    .eq("poster_id", poster.id)
    .eq("is_active", true)
    .order("price_cents", { ascending: true });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <img src={poster.image_url} alt={poster.title} />

      <h1 className="mt-6 text-3xl font-semibold">{poster.title}</h1>

      {poster.description ? (
        <p className="mt-4 text-muted-foreground">{poster.description}</p>
      ) : null}

      {variantsError ? (
        <pre className="mt-6 whitespace-pre-wrap text-sm text-red-600">
          {JSON.stringify(variantsError, null, 2)}
        </pre>
      ) : (
        <VariantPicker
          variants={variants ?? []}
          initialVariantId={initialVariantId}
        />
      )}
    </main>
  );
}

export default function PosterPage({ params, searchParams }: PosterPageProps) {
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-5xl p-6">Loading poster...</p>}
    >
      <PosterDetails params={params} searchParams={searchParams} />
    </Suspense>
  );
}
