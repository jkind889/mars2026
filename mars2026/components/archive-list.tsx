"use client";

import Link from "next/link";
import { useState } from "react";

export type ArchivePoster = {
  id: number;
  title: string;
  slug: string;
  collection: string | null;
  image_url: string | null;
  sort_order: number | null;
  created_at: string | null;
};

function posterYear(createdAt: string | null) {
  if (!createdAt) return "—";

  return new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(
    new Date(createdAt),
  );
}

function posterFocus(collection: string | null) {
  return collection?.trim() || "Poster · Print";
}

export default function ArchiveList({ posters }: { posters: ArchivePoster[] }) {
  const [activeId, setActiveId] = useState(posters[0]?.id ?? null);
  const activePoster =
    posters.find((poster) => poster.id === activeId) ?? posters[0];

  return (
    <section className="archive-workspace" aria-label="Poster archive list">
      <div className="archive-preview-mobile" aria-hidden="true">
        {activePoster?.image_url ? (
          <img src={activePoster.image_url} alt="" />
        ) : (
          <div className="archive-preview-fallback">MARS</div>
        )}
      </div>

      <div className="archive-table-wrap">
        <div className="archive-table-head" aria-hidden="true">
          <span>No.</span>
          <span>Title</span>
          <span>Collection</span>
          <span>Year</span>
        </div>

        <div className="archive-table" role="list">
          {posters.map((poster, index) => (
            <Link
              className={`archive-row${poster.id === activeId ? " is-active" : ""}`}
              href={`/posters/${poster.slug}`}
              key={poster.id}
              onFocus={() => setActiveId(poster.id)}
              onMouseEnter={() => setActiveId(poster.id)}
              role="listitem"
            >
              <span className="archive-row-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="archive-row-title">{poster.title}</span>
              <span className="archive-row-focus">
                {posterFocus(poster.collection)}
              </span>
              <span className="archive-row-year">
                {posterYear(poster.created_at)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <aside className="archive-preview" aria-live="polite">
        <div className="archive-preview-image">
          {activePoster?.image_url ? (
            <img
              key={activePoster.id}
              src={activePoster.image_url}
              alt={activePoster.title}
            />
          ) : (
            <div className="archive-preview-fallback">MARS</div>
          )}
        </div>
        <div className="archive-preview-caption">
          <span>{activePoster?.title}</span>
          {activePoster ? (
            <Link href={`/posters/${activePoster.slug}`}>View poster ↗</Link>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
