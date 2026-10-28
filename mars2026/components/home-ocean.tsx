"use client";

import { useEffect, useRef, useState } from "react";
import type { OceanEngine } from "@/lib/vendor/ascii-sharks/engine";

/** Decorative, homepage-only ocean. The simulation never owns pointer events. */
export function HomeOcean() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OceanEngine | null>(null);
  const pausedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let disposed = false;
    // Keep the renderer out of the initial page bundle and all storefront routes.
    void import("@/lib/vendor/ascii-sharks/engine").then(({ OceanEngine }) => {
      if (disposed || !canvasRef.current) return;
      engineRef.current = new OceanEngine(canvasRef.current, [
        { kind: "classic", size: 0.84 },
        { kind: "classic", size: 0.7 },
      ]);
      // Next.js can restore state after hiding this page in an Activity boundary.
      engineRef.current.setPaused(pausedRef.current);
      setReady(true);
    }).catch(() => {
      // Leave the original illustrations in place if canvas is unavailable.
    });
    return () => {
      disposed = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  function toggleMotion() {
    const next = !paused;
    pausedRef.current = next;
    engineRef.current?.setPaused(next);
    setPaused(next);
  }

  return (
    <>
      <canvas ref={canvasRef} className="home-ocean" aria-hidden="true" data-ready={ready} />
      {ready ? (
        <div className="home-ocean-controls">
          <button type="button" className="home-ocean-toggle" aria-pressed={paused} onClick={toggleMotion}>
            {paused ? "Resume fish" : "Pause fish"}
          </button>
          <span className="home-ocean-still">Still fish · reduced motion</span>
          <a href="/ascii-sharks-LICENSE.txt" aria-label="ASCII fish animation MIT license">ASCII fish · MIT</a>
        </div>
      ) : null}
    </>
  );
}
