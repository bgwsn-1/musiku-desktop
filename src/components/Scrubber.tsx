"use client";

import { useRef, useState } from "react";
import fmtTime from "@/lib/timefmt";

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/**
 * Scrubber. Pointer-drag with capture (mouse, touch, pen) and a real slider
 * keyboard model: ←/→ 5 s, PgUp/PgDn 15 s, Home/End (sliders.md, accessibility.md).
 * Hovering no longer pretends to be the playhead.
 */
export function Scrubber({
  position,
  duration,
  onSeek,
  className = "",
  thin = false,
  hairline = false,
  fat = false,
}: {
  position: number;
  duration: number;
  onSeek: (t: number) => void;
  className?: string;
  thin?: boolean;
  hairline?: boolean;
  fat?: boolean;
}) {
  const track = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const ready = duration > 0;
  const value = drag ?? position;
  const pct = ready ? clamp(value / duration, 0, 1) * 100 : 0;

  const at = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1) * duration;
  };

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={ready ? 0 : -1}
      aria-label="Posisi lagu"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${fmtTime(value)} dari ${fmtTime(duration)}`}
      aria-disabled={!ready}
      className={`group relative flex h-7 touch-none select-none items-center ${
        ready ? "cursor-pointer" : "pointer-events-none opacity-40"
      } ${className}`}
      onPointerDown={(e) => {
        if (!ready) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(at(e.clientX));
      }}
      onPointerMove={(e) => {
        if (drag !== null) setDrag(at(e.clientX));
      }}
      onPointerUp={(e) => {
        if (drag === null) return;
        onSeek(at(e.clientX));
        setDrag(null);
      }}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={(e) => {
        if (!ready) return;
        const step: Record<string, number> = {
          ArrowRight: 5,
          ArrowUp: 5,
          ArrowLeft: -5,
          ArrowDown: -5,
          PageUp: 15,
          PageDown: -15,
        };
        if (e.key in step) {
          e.preventDefault();
          onSeek(clamp(position + step[e.key], 0, duration));
        } else if (e.key === "Home") {
          e.preventDefault();
          onSeek(0);
        } else if (e.key === "End") {
          e.preventDefault();
          onSeek(Math.max(0, duration - 1));
        }
      }}
    >
      <div
        className={`relative w-full overflow-hidden rounded-full ${fat ? "bg-white/40" : "bg-[var(--track)]"} transition-[height] duration-150 ${
          hairline ? "h-[2px]" : thin ? "h-[3px]" : fat ? "h-3" : "h-1 group-hover:h-1.5 group-focus-visible:h-1.5"
        } ${drag !== null && !thin && !hairline ? (fat ? "!h-[15px]" : "!h-1.5") : ""}`}
      >
        <div className={`h-full rounded-full bg-label1 ${fat ? "" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      {!thin && !fat && (
        <div
          className={`pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.45)] transition-opacity ${
            drag !== null ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
          style={{ left: `${pct}%` }}
        />
      )}
    </div>
  );
}
