import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

async function PosterGrid() {
  const supabase = await createClient();

  const { data: posters, error } = await supabase
    .from("posters")
    .select("id, title, slug, image_url")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return <pre>{JSON.stringify(error, null, 2)}</pre>;
  }
  if (!posters?.length) {
    return <p>No posters available yet.</p>;
  }

  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posters.map((poster) => (
        <Link key={poster.id} href={`/posters/${poster.slug}`}>
          <img src={poster.image_url} alt={poster.title} />
          <h2>{poster.title}</h2>
        </Link>
      ))}
    </div>
  );
}

export default function ShopPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-semibold">Posters</h1>

      <Suspense fallback={<p className="mt-6">Loading posters...</p>}>
        <PosterGrid />
      </Suspense>
    </main>
  );
}
