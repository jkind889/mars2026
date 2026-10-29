"use client";

import { useEffect, useRef, useState } from "react";
import type { OceanEngine } from "@/lib/vendor/ascii-sharks/engine";

/** One persistent decorative ocean for the shared layout. The simulation never owns pointer events. */
export function SiteOcean() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OceanEngine | null>(null);
  const pausedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let disposed = false;
    try {
      pausedRef.current = sessionStorage.getItem("mars-ocean-paused") === "true";
    } catch {
      // Storage is optional; pausing still works for the current layout lifetime.
    }
    // Load once for the shared layout, independently of route content.
    void import("@/lib/vendor/ascii-sharks/engine").then(({ OceanEngine }) => {
      if (disposed || !canvasRef.current) return;
      engineRef.current = new OceanEngine(canvasRef.current, [
        { kind: "classic", size: 0.84 },
        { kind: "classic", size: 0.7 },
        { kind: "classic", size: 0.64 },
        { kind: "classic", size: 0.56 },
      ]);
      engineRef.current.setPaused(pausedRef.current);
      setPaused(pausedRef.current);
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
    try {
      sessionStorage.setItem("mars-ocean-paused", String(next));
    } catch {
      // A blocked storage API must not prevent the local pause control.
    }
  }

  return (
    <>
      <canvas ref={canvasRef} className="site-ocean" aria-hidden="true" data-ready={ready} />
      <div className="site-ocean-controls" id="ocean-controls" tabIndex={-1} role="group" aria-label="Animation controls">
        {ready ? <>
          <button type="button" className="site-ocean-toggle" aria-pressed={paused} onClick={toggleMotion}>
            {paused ? "Resume fish" : "Pause fish"}
          </button>
          <span className="site-ocean-still">Still fish · reduced motion</span>
          <a href="/ascii-sharks-LICENSE.txt" aria-label="ASCII fish animation MIT license">ASCII fish · MIT</a>
        </> : null}
      </div>
    </>
  );
}
