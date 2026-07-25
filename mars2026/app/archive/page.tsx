import { createClient } from "@/lib/supabase/server";
import ArchiveList, { type ArchivePoster } from "@/components/archive-list";
import { Suspense } from "react";

async function ArchivePageContent() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posters")
    .select("id, title, slug, collection, image_url, sort_order, created_at")
    .eq("status", "active")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="archive-page archive-page--message">
        <p>We couldn&apos;t load the archive right now.</p>
      </main>
    );
  }

  const posters = (data ?? []) as ArchivePoster[];

  return (
    <main className="archive-page">
      <section className="archive-intro" aria-labelledby="archive-title">
        <p className="archive-kicker">Poster archive · Available prints</p>
        <h1 id="archive-title">A collection of printed work.</h1>
        <p>
          Browse every available poster for sale as well as any other poster I&apos;ve made.
        </p>
      </section>

      {posters.length ? (
        <ArchiveList posters={posters} />
      ) : (
        <p className="archive-empty">No posters have been added yet.</p>
      )}

      <footer className="archive-footer">
        <span>{posters.length.toString().padStart(2, "0")} posters</span>
        <span>© {new Date().getFullYear()} MARS</span>
      </footer>
    </main>
  );
}

export default function ArchivePage() {
  return (
    <Suspense
      fallback={
        <main className="archive-page archive-page--message">
          <p>Loading archive...</p>
        </main>
      }
    >
      <ArchivePageContent />
    </Suspense>
  );
}
