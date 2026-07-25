"use client";

import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";

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

function previewImageUrl(imageUrl: string | null) {
  if (!imageUrl) return null;

  // Supabase Storage can resize public images at the render endpoint. Keep
  // archive previews lightweight so saving a preview does not expose the
  // original full-resolution upload.
  if (imageUrl.includes("/storage/v1/object/public/")) {
    const renderedUrl = imageUrl.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    );
    return `${renderedUrl}${renderedUrl.includes("?") ? "&" : "?"}width=900&quality=45&resize=contain`;
  }

  return imageUrl;
}

export default function ArchiveList({ posters }: { posters: ArchivePoster[] }) {
  const [activeId, setActiveId] = useState(posters[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredPosters = normalizedQuery
    ? posters.filter((poster) =>
        [poster.title, poster.collection ?? "", posterYear(poster.created_at)]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
    : posters;
  const posterNumberById = new Map(
    posters.map((poster, index) => [poster.id, index + 1]),
  );
  const activePoster =
    filteredPosters.find((poster) => poster.id === activeId) ??
    filteredPosters[0];
  const activePreviewUrl = previewImageUrl(activePoster?.image_url ?? null);
  const resultCount = `${filteredPosters.length
    .toString()
    .padStart(2, "0")} of ${posters.length.toString().padStart(2, "0")}`;

  return (
    <section className="archive-workspace" aria-label="Poster archive list">
      <div className="archive-catalog">
        <div className="archive-toolbar">
          <div
            className="archive-search"
            role="search"
            aria-label="Search poster archive"
          >
          <div className="archive-search-meta">
            <label htmlFor="archive-search">Search archive</label>
            <span role="status" aria-live="polite">
              {resultCount} posters
            </span>
          </div>
            <Input
              id="archive-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, collection, or year"
              autoComplete="off"
              aria-controls="archive-results"
            />
          </div>
          <div className="archive-layout-toggle" aria-label="Archive layout">
            <button
              type="button"
              className={layout === "list" ? "is-active" : ""}
              aria-pressed={layout === "list"}
              onClick={() => setLayout("list")}
            >
              List
            </button>
            <button
              type="button"
              className={layout === "grid" ? "is-active" : ""}
              aria-pressed={layout === "grid"}
              onClick={() => setLayout("grid")}
            >
              Grid
            </button>
          </div>
        </div>

        <div className="archive-preview-mobile" aria-hidden="true">
          {activePreviewUrl ? (
            <img src={activePreviewUrl} alt="" />
          ) : (
            <div className="archive-preview-fallback">
              {normalizedQuery ? "No match" : "MARS"}
            </div>
          )}
        </div>

        <div className={`archive-results-wrap is-${layout}`}>
        <div className="archive-table-wrap">
          <div className="archive-table-head" aria-hidden="true">
            <span>No.</span>
            <span>Title</span>
            <span>Collection</span>
            <span>Year</span>
          </div>

          <div className="archive-table" id="archive-results">
            {filteredPosters.length ? (
              filteredPosters.map((poster) => (
                <Link
                  className={`archive-row${poster.id === activePoster?.id ? " is-active" : ""}`}
                  href={`/posters/${poster.slug}`}
                  key={poster.id}
                  onFocus={() => setActiveId(poster.id)}
                  onMouseEnter={() => setActiveId(poster.id)}
                >
                  <span className="archive-row-number">
                    {String(posterNumberById.get(poster.id)).padStart(2, "0")}
                  </span>
                  <span className="archive-row-title">{poster.title}</span>
                  <span className="archive-row-focus">
                    {posterFocus(poster.collection)}
                  </span>
                  <span className="archive-row-year">
                    {posterYear(poster.created_at)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="archive-search-empty">
                No posters match &ldquo;{query.trim()}&rdquo;.
              </p>
            )}
          </div>
        </div>
        {layout === "grid" ? (
          <div className="archive-grid" id="archive-results">
            {filteredPosters.length ? filteredPosters.map((poster) => (
              <Link className="archive-card" href={`/posters/${poster.slug}`} key={poster.id}>
                <div className="archive-card-image">
                  {previewImageUrl(poster.image_url) ? (
                    <img src={previewImageUrl(poster.image_url) ?? undefined} alt="" />
                  ) : <span>MARS</span>}
                </div>
                <div className="archive-card-meta">
                  <span>{poster.title}</span>
                  <span>{posterYear(poster.created_at)}</span>
                </div>
                <span className="archive-card-focus">{posterFocus(poster.collection)}</span>
              </Link>
            )) : <p className="archive-search-empty">No posters match &ldquo;{query.trim()}&rdquo;.</p>}
          </div>
        ) : null}
        </div>
      </div>

      <aside className="archive-preview" aria-live="polite">
        <div className="archive-preview-image">
          {activePreviewUrl ? (
            <img
              key={activePoster.id}
              src={activePreviewUrl}
              alt={activePoster.title}
            />
          ) : (
            <div className="archive-preview-fallback">
              {normalizedQuery ? "No match" : "MARS"}
            </div>
          )}
        </div>
        <div className="archive-preview-caption">
          <span>{activePoster?.title ?? "No matching poster"}</span>
          {activePoster ? (
            <Link href={`/posters/${activePoster.slug}`}>View poster</Link>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
